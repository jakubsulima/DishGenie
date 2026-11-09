package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.WeekCycleDto.*;
import org.jakub.backendapi.entities.*;
import org.jakub.backendapi.entities.Enums.*;
import org.jakub.backendapi.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;
import static org.jakub.backendapi.services.WeekCycleSupport.*;

@Service
public class WeekCycleService {
    private final WeekCycleSupport s;
    private final MealPlanService plans;
    private final PlanRecipeValidationService validation;
    private final FridgeInventoryOperationService inventory;
    private final ServingScalingService scaling;
    private final UnitConversionService units;
    private final IngredientNormalizationService names;
    private final ShoppingTripRepository trips;
    private final MealPlanCandidateService candidates;
    private final PreparedPortionService portions;
    public WeekCycleService(WeekCycleSupport s,MealPlanService plans,PlanRecipeValidationService validation,
            FridgeInventoryOperationService inventory,ServingScalingService scaling,UnitConversionService units,
            IngredientNormalizationService names,ShoppingTripRepository trips,MealPlanCandidateService candidates,PreparedPortionService portions) {
        this.portions=portions;this.s=s;this.plans=plans;this.validation=validation;this.inventory=inventory;this.scaling=scaling;this.units=units;this.names=names;this.trips=trips;this.candidates=candidates;
    }
    @Transactional
    public Started create(String email,Start input) {
        var owner=s.owner(email); UUID id=input.settings().requestId();
        return s.once(owner,id,"week",input,Started.class,()->{
            if(s.repository.existsById(id))throw conflict("This intent ID already belongs to a saved plan. Open that plan.");
            var stock=s.fridge.findByUser_Id(owner.getId());
            if(!stock.stream().map(FridgeIngredient::getId).toList().containsAll(input.priorityFridgeIds())) throw error("Fridge item unavailable",HttpStatus.NOT_FOUND);
            var settings=input.settings();
            if(settings.planningMode()==PlanningMode.DEALS) settings=new Create(settings.requestId(),settings.startDate(),settings.dayCount(),settings.servings(),settings.mealTypes(),settings.stores(),settings.budget(),settings.locale(),settings.maxMinutes(),PlanningMode.PRACTICAL,settings.budgetMode(),settings.shopping());
            var created=plans.create(email,settings); var p=s.owned(email,created.id());var d=s.read(p);
            var unique=new HashSet<String>();
            for(var e:input.exceptions()) {
                if(!unique.add(e.date()+":"+e.mealType()) || d.slots().stream().noneMatch(slot->slot.date().equals(e.date())&&slot.mealType()==e.mealType()))
                    throw error("Exception must identify one meal in this week",HttpStatus.BAD_REQUEST);
            }
            var slots=d.slots().stream().map(slot->new Slot(slot.id(),slot.date(),slot.mealType(),slot.servings(),false,
                input.exceptions().stream().anyMatch(e->e.date().equals(slot.date())&&e.mealType()==slot.mealType()&&e.skipped()),null,null,null,null)).toList();
            Set<UUID> batchSlots = new HashSet<>();
            for (var e : input.exceptions().stream().sorted(Comparator.comparing(ExceptionDay::date)).toList()) if (e.cookForNext()) {
                if(e.skipped()) throw error("Skipped meals cannot cook for tomorrow",HttpStatus.BAD_REQUEST);
                var source=slots.stream().filter(slot->slot.date().equals(e.date())&&slot.mealType()==e.mealType()).findFirst().orElseThrow();
                var target=slots.stream().filter(slot->slot.date().isAfter(e.date())&&slot.mealType()==e.mealType()&&!slot.skipped()).min(Comparator.comparing(Slot::date))
                    .orElseThrow(()->error("Choose a later meal for the extra portions",HttpStatus.BAD_REQUEST));
                if(!batchSlots.add(source.id())||!batchSlots.add(target.id())) throw error("Cooking allocations overlap",HttpStatus.BAD_REQUEST);
            }
            var next=new Document(4,d.settings(),Status.DRAFT,slots,null,new Cycle(input.exceptions(),input.priorityFridgeIds(),List.of(),false));
            return new Started(s.save(p,next),UUID.nameUUIDFromBytes(("week-start:"+id).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        });
    }
    @Transactional(readOnly=true)
    public Shopping previewShopping(String email,UUID id) {
        var p=s.repository.findByIdAndUserEmail(id,email).orElseThrow(()->error("Plan unavailable",HttpStatus.NOT_FOUND));return s.shopping(p,s.read(p));
    }
    public int maxMinutes(Document d,Slot slot) {
        return s.cycle(d).exceptions().stream().filter(e->e.date().equals(slot.date())&&e.mealType()==slot.mealType()&&e.maxMinutes()!=null)
            .map(ExceptionDay::maxMinutes).findFirst().orElse(d.settings().maxMinutes());
    }
    private String dependencies(String email,Long owner) {
        String planVersions=s.repository.findByUserEmailOrderByCreatedAtDescIdDesc(email,org.springframework.data.domain.PageRequest.of(0,100)).stream().map(p->p.getId()+"@"+p.getVersion()).sorted().reduce("",(a,b)->a+","+b);
        return s.fingerprint(owner)+":"+planVersions+":"+trips.findByUserEmailOrderByCreatedAtDesc(email).stream().map(t->t.getId()+"@"+t.getVersion()).sorted().reduce("",(a,b)->a+","+b);
    }
    @Transactional
    public ChangePreview preview(String email,UUID id,BatchChange input) {
        var owner=s.owner(email);
        return s.once(owner,input.requestId(),"change-preview:"+id,input,ChangePreview.class,()->{
            var p=s.owned(email,id);s.version(p.getVersion(),input.version());var d=s.read(p);s.idle(d);
            var before=s.shopping(p,d);var after=change(email,p,d,input);
            var next=s.shopping(p,after);
            Set<String> nextNames=new HashSet<>();next.items().forEach(i->nextNames.add(names.canonicalName(i.name())));
            var unused=before.items().stream().filter(i->!nextNames.contains(names.canonicalName(i.name())))
                .map(ShoppingItem::name).toList();
            return new ChangePreview(input.requestId(),p.getVersion(),dependencies(email,owner.getId()),Instant.now().plusSeconds(900),
                after,before,next,unused,after.slots().stream().filter(slot->!slot.equals(s.slot(d,slot.id()))).map(Slot::id).toList());
        });
    }
    public record Apply(@jakarta.validation.constraints.Min(0) long version,@jakarta.validation.constraints.NotNull UUID requestId,@jakarta.validation.constraints.NotNull UUID previewId) {}
    @Transactional
    public View apply(String email,UUID id,Apply input) {
        var owner=s.owner(email);
        return s.once(owner,input.requestId(),"change-apply:"+id,input,View.class,()->{
            var p=s.owned(email,id);s.version(p.getVersion(),input.version());s.idle(s.read(p));
            var stored=s.requests.findById(input.previewId()).orElseThrow(()->error("Preview unavailable",HttpStatus.NOT_FOUND));
            if(!stored.getUser().getId().equals(owner.getId()) || !stored.getInput().startsWith("change-preview:"+id+":")) throw error("Preview unavailable",HttpStatus.NOT_FOUND);
            var preview=s.json.readValue(stored.getResult(),ChangePreview.class);
            if(preview.planVersion()!=p.getVersion()||!preview.expiresAt().isAfter(Instant.now())||!preview.inventoryFingerprint().equals(dependencies(email,owner.getId())))
                throw conflict("Plan, visit or fridge changed. Preview again.");
            for(var slot:preview.after().slots()) if(preview.affectedSlots().contains(slot.id())&&!slot.skipped()&&slot.recipe()!=null
                    && s.forSlot(preview.after(),slot.id()).status().equals("PLANNED"))
                validation.validate(email,slot.recipe(),maxMinutes(preview.after(),slot),slot.recipe().getLocale()==null?preview.after().settings().locale():slot.recipe().getLocale().name());
            portions.reconcile(email,id,preview.after());
            return s.save(p,preview.after());
        });
    }
    private Document change(String email,MealPlan p,Document d,BatchChange in) {
        if((in.action().equals("MOVE")||in.action().equals("SHARE"))&&in.targetSlotId()==null)throw error("Choose a target meal",HttpStatus.BAD_REQUEST);
        Slot source=s.slot(d,in.slotId());if(source.locked()) throw conflict("Unlock this meal first.");
        var batches=new ArrayList<>(s.batches(d));var slots=new ArrayList<>(d.slots());
        if(source.recipe()==null || source.skipped()) throw conflict("Choose a planned meal.");
        Batch b=s.forSlot(d,source.id());
        if(in.action().equals("MOVE")) {
            var target=s.slot(d,Objects.requireNonNull(in.targetSlotId()));
            validation.validate(email,b.recipe(),maxMinutes(d,target),d.settings().locale());
            if(target.locked()||target.recipe()!=null&&!target.skipped()) throw conflict("The destination is occupied. Choose an empty meal.");
            if(b.allocations().size()>1 && source.date().equals(b.cookingDate())) throw conflict("Move the linked meals before moving their cooking day.");
            if(target.date().isBefore(b.cookingDate())&&b.status().equals("COOKED")) throw conflict("A portion cannot precede its cooking.");
            var allocations=b.allocations().stream().map(a->a.slotId().equals(source.id())?new Allocation(target.id(),a.portions(),a.status()):a).toList();
            batches.remove(b);batches.add(new Batch(b.id(),b.allocations().size()==1?target.date():b.cookingDate(),b.recipe(),b.portions(),b.status(),allocations,b.inventoryOperationId(),b.inventoryReview(),b.storage()));
            replace(slots,new Slot(target.id(),target.date(),target.mealType(),source.servings(),false,false,b.recipe(),null,null,null));
            replace(slots,empty(source));
        } else if(in.action().equals("SHARE")) {
            if(!b.status().equals("PLANNED")) throw conflict("Allocate remaining cooked portions using the portion action.");
            var target=s.slot(d,Objects.requireNonNull(in.targetSlotId()));
            if(target.id().equals(source.id())||target.date().isBefore(b.cookingDate())||target.locked()) throw conflict("Choose a later unlocked meal.");
            if(b.allocations().stream().anyMatch(a->a.slotId().equals(target.id()))) throw conflict("This meal already uses this cooking.");
            if(target.recipe()!=null&&!target.skipped()) {
                if(!in.replaceOccupied()) throw conflict("Confirm replacing the occupied meal in the preview.");
                var old=s.forSlot(d,target.id());if(!old.status().equals("PLANNED")||old.allocations().size()!=1) throw conflict("The target is linked to another cooking.");
                batches.remove(old);
            }
            int count=in.portions()==null?source.servings():in.portions();var allocations=new ArrayList<>(b.allocations());allocations.add(new Allocation(target.id(),count,"PLANNED"));
            batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),b.recipe(),b.portions()+count,"PLANNED",allocations,null,false,null));
            replace(slots,new Slot(target.id(),target.date(),target.mealType(),count,false,false,b.recipe(),null,null,null));
        } else if(in.action().equals("SKIP")||in.action().equals("RELEASE")) {
            var allocation=b.allocations().stream().filter(a->a.slotId().equals(source.id())).findFirst().orElseThrow();
            if(allocation.eatenPortions()>0 || allocation.status().equals("EATEN")) throw conflict("Already eaten portions cannot be removed.");
            var allocations=b.allocations().stream().filter(a->!a.slotId().equals(source.id())).toList();
            int portions=b.status().equals("PLANNED")&&!in.keepExtra()?b.portions()-allocation.portions():b.portions();
            LocalDate date=allocations.stream().map(a->s.slot(d,a.slotId()).date()).min(LocalDate::compareTo).orElse(b.cookingDate());
            batches.remove(b);batches.add(new Batch(b.id(),b.status().equals("COOKED")?b.cookingDate():date,b.recipe(),portions,
                portions==0?"CANCELLED":b.status(),allocations,b.inventoryOperationId(),b.inventoryReview(),b.storage()));
            replace(slots,empty(source));
        } else if(in.action().equals("SERVINGS")) {
            if(!b.status().equals("PLANNED")||in.portions()==null) throw conflict("Change portions before cooking.");
            var allocations=b.allocations().stream().map(a->a.slotId().equals(source.id())?new Allocation(a.slotId(),in.portions(),a.status()):a).toList();
            batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),b.recipe(),allocations.stream().mapToInt(Allocation::portions).sum(),b.status(),allocations,null,false,null));
            replace(slots,new Slot(source.id(),source.date(),source.mealType(),in.portions(),source.locked(),source.skipped(),source.recipe(),null,null,null));
        } else if(in.action().equals("RECIPE")) {
            if(!b.status().equals("PLANNED")) throw conflict("Cooked history cannot be replaced. Release a future allocation first.");
            RecipeDto recipe=in.recipe();
            if(recipe==null) recipe=candidates.choose(email,s.view(p),source,candidates.deals(email,d.settings()),List.of());
            if(recipe==null) throw error("No permitted library replacement. Edit the recipe or move this meal.",HttpStatus.UNPROCESSABLE_ENTITY);
            if(in.recipe()!=null&&!recipe.getIngredients().stream().map(RecipeIngredientDto::getName).toList().equals(b.recipe().getIngredients().stream().map(RecipeIngredientDto::getName).toList())&&recipe.getInstructions().equals(b.recipe().getInstructions()))
                throw error("Update preparation instructions after changing ingredients.",HttpStatus.BAD_REQUEST);
            for(var a:b.allocations()) validation.validate(email,recipe,maxMinutes(d,s.slot(d,a.slotId())),recipe.getLocale()==null?d.settings().locale():recipe.getLocale().name());
            batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),recipe,b.portions(),b.status(),b.allocations(),null,false,null));
            for(var a:b.allocations()) { var old=s.slot(d,a.slotId());replace(slots,new Slot(old.id(),old.date(),old.mealType(),a.portions(),old.locked(),old.skipped(),recipe,null,null,null)); }
        } else if(in.action().equals("STORE")) {
            if(!b.status().equals("COOKED")||in.storage()==null) throw conflict("Choose storage for cooked portions.");
            portions.protectOriginal(p.getId(),b.id());
            batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),b.recipe(),b.portions(),b.status(),b.allocations(),b.inventoryOperationId(),b.inventoryReview(),in.storage()));
        }
        return s.withBatches(d,slots,batches,s.cycle(d).inventoryReview());
    }
    private void replace(List<Slot> slots,Slot next) { slots.replaceAll(old->old.id().equals(next.id())?next:old); }
    private Slot empty(Slot old) { return new Slot(old.id(),old.date(),old.mealType(),old.servings(),false,true,null,null,null,null); }
    @Transactional(readOnly=true)
    public CookPreview cookingPreview(String email,UUID id,UUID batchId,Integer portions) {
        var p=s.repository.findByIdAndUserEmail(id,email).orElseThrow(()->error("Plan unavailable",HttpStatus.NOT_FOUND));var d=s.read(p);var b=s.batch(d,batchId);
        int count=portions==null?b.portions():portions;
        if(count<1||count>1400) throw error("Prepared portions must be between 1 and 1400",HttpStatus.BAD_REQUEST);
        var demand=new Slot(b.id(),b.cookingDate(),MealType.LUNCH,count,false,false,b.recipe(),null,null,null);
        var stock=s.fridge.findByUser_Id(p.getUser().getId());
        var uncovered=s.aggregation.aggregate(List.of(demand),stock,d.settings().locale());
        List<FridgeInventoryChangeRequestDto> changes=new ArrayList<>();Map<Long,Double> used=new HashMap<>();
        for(var ingredient:scaling.scale(b.recipe().getIngredients(),b.recipe().getServings(),count)) {
            var unit=units.normalize(ingredient.getUnit()).orElse(null);if(unit==null) continue;
            double remaining=units.toBaseAmount(ingredient.getAmount(),unit);
            for(var item:stock.stream().sorted(Comparator.comparing(FridgeIngredient::getExpirationDate,Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
                var stockUnit=units.normalize(item.getUnit()==null?null:item.getUnit().name()).orElse(null);
                if(item.getQuantityAccuracy()!=QuantityAccuracy.EXACT||item.getAmount()==null||!Double.isFinite(item.getAmount())||item.getAmount()<=0||!units.areCompatible(unit,stockUnit)
                    ||item.getExpirationDate()!=null&&item.getExpirationDate().isBefore(b.cookingDate())||!same(ingredient.getName(),item.getName(),d.settings().locale())) continue;
                double available=units.toBaseAmount(item.getAmount(),stockUnit)-used.getOrDefault(item.getId(),0d);double take=Math.min(remaining,Math.max(0,available));
                if(take>1e-9) { used.merge(item.getId(),take,Double::sum);remaining-=take; }if(remaining<=1e-9) break;
            }
        }
        for(var item:stock) if(used.containsKey(item.getId())) {
            var c=new FridgeInventoryChangeRequestDto();c.setType(FridgeOperationChangeType.DECREMENT);c.setFridgeItemId(item.getId());c.setName(item.getName());
            c.setAmount(units.fromBaseAmount(used.get(item.getId()),units.normalize(item.getUnit().name()).orElseThrow()));c.setUnit(units.normalize(item.getUnit().name()).orElseThrow().canonical());c.setClientChangeId(item.getId().toString());changes.add(c);
        }
        return new CookPreview(batchId,p.getVersion(),s.fingerprint(p.getUser().getId()),count,changes,uncovered,cookedAllocations(d,b,count));
    }
    private List<Allocation> cookedAllocations(Document d,Batch b,int portions) {
        List<Allocation> result=new ArrayList<>();int remaining=portions;
        for(var a:b.allocations().stream().sorted(Comparator.comparing(a->s.slot(d,a.slotId()).date())).toList()) {
            int count=Math.min(a.portions(),remaining);remaining-=count;
            result.add(new Allocation(a.slotId(),count,count==0?"SKIPPED":"PLANNED",0));
        }
        return result;
    }
    private boolean same(String a,String b,String locale) {
        var x=names.resolve(a,locale);var y=names.resolve(b,locale);
        return x.isResolved()&&y.isResolved()?x.ingredient().getId().equals(y.ingredient().getId()):names.canonicalName(a).equals(names.canonicalName(b));
    }
    @Transactional
    public View cook(String email,UUID id,UUID batchId,Cook in) {
        var owner=s.owner(email);
        return s.once(owner,in.requestId(),"cook:"+id+":"+batchId,in,View.class,()->{
            var p=s.owned(email,id);s.version(p.getVersion(),in.version());var d=s.read(p);s.idle(d);var b=s.batch(d,batchId);
            if(!b.status().equals("PLANNED")) throw conflict("This cooking is already recorded.");
            if(!in.inventoryFingerprint().equals(s.fingerprint(owner.getId()))) throw conflict("Fridge changed. Review consumption again.");
            var preview=cookingPreview(email,id,batchId,in.portions());String operation=null;
            boolean review=!in.updateInventory()||preview.uncovered().items().stream().anyMatch(i->i.needsReview()||i.amount()==null||i.amount()>0);
            if(in.updateInventory()&&!preview.changes().isEmpty()) {
                List<String> operations=new ArrayList<>();
                for(int offset=0;offset<preview.changes().size();offset+=50) {
                    String operationId=UUID.nameUUIDFromBytes(("cook:"+in.requestId()+":"+offset).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();operations.add(operationId);
                    var request=new FridgeInventoryOperationRequestDto();request.setOperationId(operationId);request.setSource(FridgeOperationSource.COOKED_RECIPE);request.setSourceReference(batchId.toString());
                    request.setChanges(preview.changes().subList(offset,Math.min(offset+50,preview.changes().size())));
                    var result=inventory.apply(request,email);review|=!result.getSkippedChanges().isEmpty();
                }
                operation=String.join(",",operations);
            }
            var batches=new ArrayList<>(s.batches(d));batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),b.recipe(),in.portions(),"COOKED",preview.allocations(),operation,review,null));
            var slots=d.slots().stream().map(slot->{var allocation=preview.allocations().stream().filter(a->a.slotId().equals(slot.id())).findFirst();
                if(allocation.isEmpty())return slot;var a=allocation.get();return new Slot(slot.id(),slot.date(),slot.mealType(),Math.max(1,a.portions()),slot.locked(),a.portions()==0,slot.recipe(),slot.generationId(),slot.generationStatus(),slot.generationStartedAt());}).toList();
            return s.save(p,s.withBatches(d,slots,batches,s.cycle(d).inventoryReview()||review));
        });
    }
    @Transactional
    public View eat(String email,UUID id,UUID slotId,Eat in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"eat:"+id+":"+slotId,in,View.class,()->{
            var p=s.owned(email,id);s.version(p.getVersion(),in.version());var d=s.read(p);var b=s.forSlot(d,slotId);
            if(!b.status().equals("COOKED")||"DISCARDED".equals(b.storage())) throw conflict("Cook this meal first.");
            var a=b.allocations().stream().filter(x->x.slotId().equals(slotId)).findFirst().orElseThrow();
            if(a.status().equals("EATEN")||in.portions()>a.portions()-a.eatenPortions()) throw conflict("Only remaining allocated portions can be eaten.");
            var allocations=b.allocations().stream().map(x->x==a?new Allocation(x.slotId(),x.portions(),x.eatenPortions()+in.portions()==x.portions()?"EATEN":"PLANNED",x.eatenPortions()+in.portions()):x).toList();
            var batches=new ArrayList<>(s.batches(d));batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),b.recipe(),b.portions(),b.status(),allocations,b.inventoryOperationId(),b.inventoryReview(),b.storage()));
            var after=s.withBatches(d,d.slots(),batches,s.cycle(d).inventoryReview());portions.reconcile(email,id,after);return s.save(p,after);
        });
    }
    @Transactional
    public View undoCooking(String email,UUID id,UUID batchId,Command in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"undo-cook:"+id+":"+batchId,in,View.class,()->{
            var p=s.owned(email,id);s.version(p.getVersion(),in.version());var d=s.read(p);var b=s.batch(d,batchId);
            if(portions.isTransfer(b.id()))throw conflict("Undo this cooking in its original week.");
            portions.protectOriginal(id,b.id());
            if(!b.status().equals("COOKED")||b.allocations().stream().anyMatch(a->a.eatenPortions()>0 || a.status().equals("EATEN"))) throw conflict("Eaten portions depend on this cooking.");
            if(b.inventoryOperationId()!=null) {
                var operations=new ArrayList<>(List.of(b.inventoryOperationId().split(",")));Collections.reverse(operations);
                for(String operation:operations) inventory.undo(operation,UUID.nameUUIDFromBytes((in.requestId()+":"+operation).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString(),email);
            }
            var batches=new ArrayList<>(s.batches(d));batches.remove(b);batches.add(new Batch(b.id(),b.cookingDate(),b.recipe(),b.portions(),"PLANNED",b.allocations(),null,false,null));
            return s.save(p,s.withBatches(d,d.slots(),batches,s.cycle(d).inventoryReview()));
        });
    }
    @Transactional(readOnly=true)
    public Today today(String email,UUID id,LocalDate date) {
        var plan=plans.get(email,id);var d=plan.plan();final var requestedDate=date;var selected=d.slots().stream().filter(slot->!slot.skipped()&&slot.date().equals(requestedDate)).toList();
        if(selected.isEmpty()) { var next=d.slots().stream().filter(slot->!slot.skipped()&&!slot.date().isBefore(requestedDate)).map(Slot::date).min(LocalDate::compareTo);
            if(next.isPresent()) { date=next.get(); final var day=date;selected=d.slots().stream().filter(slot->!slot.skipped()&&slot.date().equals(day)).toList(); } }
        return new Today(date,selected,s.batches(d),s.cycle(d).inventoryReview());
    }
    public record ReadyPortions(UUID planId,long sourceVersion,UUID batchId,String name,int remaining,int unallocated,String storage) {}
    public record Resources(String inventoryFingerprint,List<UUID> overlappingPlanIds,List<ReadyPortions> readyPortions) {}
    @Transactional(readOnly=true)
    public List<ReadyPortions> readyPortions(String email) {
        return s.repository.findByUserEmailOrderByCreatedAtDescIdDesc(email,org.springframework.data.domain.PageRequest.of(0,100)).stream()
            .flatMap(p->s.batches(s.read(p)).stream().filter(b->b.status().equals("COOKED")&&!"DISCARDED".equals(b.storage())&&!portions.isTransfer(b.id()))
                .map(b->new ReadyPortions(p.getId(),p.getVersion(),b.id(),b.recipe().getName(),b.portions()-b.allocations().stream().mapToInt(Allocation::eatenPortions).sum()-portions.eatenElsewhere(p.getId(),b),
                    portions.unallocated(p.getId(),b),b.storage())))
            .filter(r->r.remaining()>0).toList();
    }
    @Transactional(readOnly=true)
    public Resources resources(String email,UUID id) {
        var plan=plans.get(email,id);var d=plan.plan();
        var conflicts=s.repository.findByUserEmailOrderByCreatedAtDescIdDesc(email,org.springframework.data.domain.PageRequest.of(0,100)).stream()
            .filter(p->!p.getId().equals(id)).filter(p->{var other=s.read(p);return !other.settings().startDate().isAfter(d.settings().startDate().plusDays(d.settings().dayCount()-1))
                && !d.settings().startDate().isAfter(other.settings().startDate().plusDays(other.settings().dayCount()-1))
                && s.batches(other).stream().anyMatch(b->b.status().equals("PLANNED"));}).map(MealPlan::getId).toList();
        return new Resources(s.fingerprint(s.users.findByEmail(email).orElseThrow().getId()),conflicts,readyPortions(email));
    }
    public record Reviewed(@jakarta.validation.constraints.Min(0) long version,@jakarta.validation.constraints.NotNull UUID requestId,@jakarta.validation.constraints.NotBlank String inventoryFingerprint) {}
    @Transactional
    public View reviewed(String email,UUID id,Reviewed in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"reviewed-stock:"+id,in,View.class,()->{
            var p=s.owned(email,id);s.version(p.getVersion(),in.version());if(!s.fingerprint(owner.getId()).equals(in.inventoryFingerprint()))throw conflict("Fridge changed. Check quantities again.");
            var d=s.read(p);return s.save(p,s.withBatches(d,d.slots(),s.batches(d),false));
        });
    }

}
