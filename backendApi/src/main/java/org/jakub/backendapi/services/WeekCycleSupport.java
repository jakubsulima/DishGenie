package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.WeekCycleDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Shared invariants. Mutating callers must hold an owner lock in a transaction. */
@Service
public class WeekCycleSupport {
    final MealPlanRepository repository;
    final UserRepository users;
    final FridgeIngredientRepository fridge;
    final CycleRequestRepository requests;
    final PlanIngredientAggregationService aggregation;
    final ObjectMapper json;
    public WeekCycleSupport(MealPlanRepository repository, UserRepository users, FridgeIngredientRepository fridge,
            CycleRequestRepository requests, PlanIngredientAggregationService aggregation, ObjectMapper json) {
        this.repository=repository; this.users=users; this.fridge=fridge; this.requests=requests; this.aggregation=aggregation; this.json=json;
    }
    public User owner(String email) { return users.findByEmailForUpdate(email).orElseThrow(() -> error("User unavailable", HttpStatus.UNAUTHORIZED)); }
    public MealPlan owned(String email, UUID id) { return repository.findOwnedForUpdate(id,email).orElseThrow(() -> error("Plan unavailable",HttpStatus.NOT_FOUND)); }
    public Document read(MealPlan p) { return json.readValue(p.getDocument(),Document.class); }
    public View view(MealPlan p) { return new View(p.getId(),p.getVersion(),p.getCreatedAt(),read(p)); }
    public View save(MealPlan p, Document d) {
        if (p.getDocument()!=null && read(p).schemaVersion()>d.schemaVersion()) throw conflict("Update the planner before changing this week.");
        p.setDocument(json.writeValueAsString(d)); return view(repository.saveAndFlush(p));
    }
    public void version(long current,long expected) { if(current!=expected) throw conflict("Changed elsewhere. Reload and preview again."); }
    public void idle(Document d) { if(d.slots().stream().anyMatch(s -> s.generationStatus()==GenerationStatus.RUNNING
            && s.generationStartedAt()!=null && s.generationStartedAt().isAfter(Instant.now().minusSeconds(300))))
        throw conflict("Wait for the current cooking proposal."); }
    public Cycle cycle(Document d) { return d.cycle()==null ? new Cycle(List.of(),Set.of(),List.of(),false):d.cycle(); }
    public Slot slot(Document d,UUID id) { return d.slots().stream().filter(s->s.id().equals(id)).findFirst().orElseThrow(()->error("Meal unavailable",HttpStatus.NOT_FOUND)); }
    public List<Batch> batches(Document d) {
        List<Batch> result=new ArrayList<>(cycle(d).batches());
        Set<UUID> allocated=new HashSet<>(); result.forEach(b->b.allocations().stream().filter(a->!a.status().equals("SKIPPED")).forEach(a->allocated.add(a.slotId())));
        for(var s:d.slots()) if(s.recipe()!=null && !s.skipped() && !allocated.contains(s.id()))
            result.add(new Batch(cycle(d).batches().stream().anyMatch(b->b.id().equals(s.id())) && s.generationId()!=null ? s.generationId() : s.id(),s.date(),s.recipe(),s.servings(),"PLANNED",List.of(new Allocation(s.id(),s.servings(),"PLANNED")),null,false,null));
        return result;
    }
    public Batch batch(Document d,UUID id) { return batches(d).stream().filter(b->b.id().equals(id)).findFirst().orElseThrow(()->error("Cooking unavailable",HttpStatus.NOT_FOUND)); }
    public Batch forSlot(Document d,UUID id) { return batches(d).stream().filter(b->b.allocations().stream().anyMatch(a->a.slotId().equals(id)&&!a.status().equals("SKIPPED")))
            .findFirst().orElseThrow(()->error("Cooking unavailable",HttpStatus.NOT_FOUND)); }
    public Document withBatches(Document d,List<Slot> slots,List<Batch> batches,boolean review) {
        var c=cycle(d); return new Document(4,d.settings(),d.status(),slots,null,new Cycle(c.exceptions(),c.priorityFridgeIds(),List.copyOf(batches),review));
    }
    public Shopping shopping(MealPlan p,Document d) {
        return aggregation.aggregate(d, cycle(d).inventoryReview()?List.of():fridge.findByUser_Id(p.getUser().getId()),d.settings().locale());
    }
    public String fingerprint(Long userId) {
        var stock=fridge.findByUser_Id(userId).stream().sorted(Comparator.comparing(FridgeIngredient::getId)).map(i->
            Arrays.asList(i.getId(),i.getName(),i.getAmount(),i.getUnit(),i.getExpirationDate(),i.getQuantityAccuracy(),i.getStockState(),i.getLastConfirmedAt())).toList();
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(stock).getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    public <T> T once(User owner,UUID id,String operation,Object input,Class<T> type,Supplier<T> work) {
        String signature=operation+":"+json.writeValueAsString(input);
        var previous=requests.findById(id);
        if(previous.isPresent()) {
            var r=previous.get(); if(!r.getUser().getId().equals(owner.getId())||!signature.equals(r.getInput())) throw conflict("Request ID was used with different data.");
            if(r.getResult()==null) throw conflict("Request is still pending.");
            return json.readValue(r.getResult(),type);
        }
        var result=work.get(); var r=new CycleRequest();r.setId(id);r.setUser(owner);r.setCreatedAt(Instant.now());r.setInput(signature);r.setResult(json.writeValueAsString(result));requests.saveAndFlush(r);return result;
    }
    public static AppException conflict(String message){return error(message,HttpStatus.CONFLICT);}
    public static AppException error(String message,HttpStatus status){return new AppException(message,status);}
}
