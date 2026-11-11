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
public class ShoppingTripService {
    private final WeekCycleSupport s;
    private final ShoppingTripRepository trips;
    private final ShoppingListItemRepository manual;
    private final FridgeInventoryOperationService inventory;
    private final UnitConversionService units;
    private final IngredientNormalizationService names;
    private final MealPlanPricingService pricing;
    private final StoreOfferService offers;
    public ShoppingTripService(WeekCycleSupport s,ShoppingTripRepository trips,ShoppingListItemRepository manual,
            FridgeInventoryOperationService inventory,UnitConversionService units,IngredientNormalizationService names,MealPlanPricingService pricing,StoreOfferService offers) {
        this.pricing=pricing;this.offers=offers;this.s=s;this.trips=trips;this.manual=manual;this.inventory=inventory;this.units=units;this.names=names;
    }
    public record ManualItem(Long id,String name,Double amount,String unit) {}
    @Transactional(readOnly=true)
    public List<ManualItem> pending(String email) {
        var owner=s.users.findByEmail(email).orElseThrow();
        return manual.findByUserOrderByCreatedAtAsc(owner).stream().filter(i->!i.isChecked()).map(i->new ManualItem(i.getId(),i.getName(),i.getAmount(),i.getUnit())).toList();
    }
    @Transactional(readOnly=true)
    public List<TripView> list(String email) { return trips.findByUserEmailOrderByCreatedAtDesc(email).stream().map(this::view).toList(); }
    @Transactional(readOnly=true)
    public TripView get(String email,UUID id) { return view(owned(email,id)); }
    private ShoppingTrip owned(String email,UUID id) { return trips.findByIdAndUserEmail(id,email).orElseThrow(()->error("Visit unavailable",HttpStatus.NOT_FOUND)); }
    private TripDocument read(ShoppingTrip t) { return s.json.readValue(t.getDocument(),TripDocument.class); }
    private TripView view(ShoppingTrip t) {return new TripView(t.getId(),t.getPlanId(),t.getVersion(),t.getStatus(),t.getCreatedAt(),read(t));}
    private TripView save(ShoppingTrip t,TripDocument d) { t.setDocument(s.json.writeValueAsString(d));return view(trips.saveAndFlush(t)); }
    private void open(ShoppingTrip t,long version) {s.version(t.getVersion(),version);if(!Set.of("DRAFT","IN_PROGRESS").contains(t.getStatus())) throw conflict("This visit is complete. Prepare a supplementary visit.");}
    @Transactional
    public TripView prepare(String email,UUID planId,Prepare in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"prepare:"+planId,in,TripView.class,()->{
            MealPlan plan=planId==null?null:s.owned(email,planId);
            Document d=plan==null?null:s.read(plan);
            if(plan!=null) {s.version(plan.getVersion(),in.version());s.idle(d);}
            var existing=trips.findByUserEmailOrderByCreatedAtDesc(email).stream().filter(t->Objects.equals(t.getPlanId(),planId)&&Set.of("DRAFT","IN_PROGRESS").contains(t.getStatus())).findFirst();
            var trip=existing.orElseGet(()->{var t=new ShoppingTrip();t.setId(UUID.randomUUID());t.setUser(owner);t.setPlanId(planId);t.setStatus("DRAFT");t.setCreatedAt(Instant.now());return t;});
            var old=existing.map(this::read).orElse(new TripDocument(List.of(),null,null));
            List<TripLine> rows=new ArrayList<>();Set<UUID> retained=new HashSet<>();
            Shopping requirements=plan==null?null:s.shopping(plan,d);
            org.jakub.backendapi.dto.StoreOfferDto.Quote currentQuote=null;
            if(plan!=null) {
                var date=d.settings().shopping().shoppingDate();if(date==null||date.isBefore(LocalDate.now(ZoneId.of("Europe/Warsaw"))))date=LocalDate.now(ZoneId.of("Europe/Warsaw"));
                var input=new org.jakub.backendapi.dto.StoreOfferDto.QuoteRequest(plan.getVersion(),date,d.settings().shopping().loyaltyStores(),d.settings().shopping().confirmedCouponOffers());
                // Use available saved prices only. Opening a visit never refreshes a remote catalog.
                currentQuote=pricing.calculateForUser(email,new View(plan.getId(),plan.getVersion(),plan.getCreatedAt(),d.withSlots(d.slots(),d.status(),requirements)),input,offers.eligibleForUser(email, d.settings().stores(),date,Instant.now()),Instant.now());
            }
            if(plan!=null) for(var need:requirements.items()) {
                String identity=identity(need.name(),need.unit(),d.settings().locale());
                var previous=old.lines().stream().filter(l->l.source().equals("PLAN")&&identity(l.name(),l.unit(),d.settings().locale()).equals(identity)&&(!need.needsReview()||Objects.equals(l.requirementKey(),need.key()))).findFirst().orElse(null);
                UUID lineId=previous==null?UUID.randomUUID():previous.id();retained.add(lineId);
                boolean unchanged=previous!=null&&Objects.equals(previous.toBuy(),need.amount())&&previous.needsReview()==need.needsReview();
                Double suggestion=need.amount();String department="OTHER";String store=d.settings().stores().stream().sorted().findFirst().orElseThrow().name();java.math.BigDecimal packages=null;
                if(currentQuote!=null) {
                    String selected=d.shopping()==null?null:d.shopping().basketOption();
                    var basket=currentQuote.baskets().stream().filter(b->selected==null?!b.option().equals("COMBINED"):b.option().equals(selected)).findFirst();
                    if(basket.isPresent()) {store=basket.get().stores().stream().sorted().findFirst().orElseThrow().name();var priced=basket.get().items().stream().filter(i->i.key().equals(need.key())).findFirst();
                        if(priced.isPresent()) {var price=priced.get();if(price.purchasedAmount()!=null)suggestion=price.purchasedAmount().doubleValue();packages=price.packages();
                            if(price.manualPrice()!=null)store=price.manualPrice().store().name();
                            if(price.offer()!=null){department=price.offer().details().category();store=price.offer().details().store().name();}}}
                }
                rows.add(new TripLine(lineId,"PLAN",null,need.key(),need.name(),need.amount()==null?null:need.amount()+need.usedFromFridge(),need.usedFromFridge(),need.amount(),need.unit(),need.needsReview(),need.slotIds(),
                    unchanged?previous.state():"NEEDED",previous==null?null:previous.purchasedAmount(),previous==null?null:previous.purchasedUnit(),false,
                    previous==null?null:previous.importStatus(),previous==null?null:previous.actualPrice(),suggestion,department,store,packages));
            }
            for(var l:old.lines()) if(!l.source().equals("PLAN")||!retained.contains(l.id())&&l.purchasedAmount()!=null) rows.add(l);
            var available=manual.findByUserOrderByCreatedAtAsc(owner);
            for(Long id:in.manualItemIds()) {
                var item=available.stream().filter(i->i.getId().equals(id)).findFirst().orElseThrow(()->error("Manual item unavailable",HttpStatus.NOT_FOUND));
                if(rows.stream().noneMatch(l->Objects.equals(l.manualItemId(),id))) rows.add(line(UUID.randomUUID(),"MANUAL",id,item.getName(),item.getAmount(),item.getUnit()));
            }
            if(rows.isEmpty()) throw conflict("There are no shopping requirements. Add a manual item or a meal.");
            return save(trip,new TripDocument(rows,null,null));
        });
    }
    private String identity(String name,String unit,String locale) {var n=names.resolve(name,locale);return (n.isResolved()?"id:"+n.ingredient().getId():"name:"+names.canonicalName(name))+"|"+unit;}
    private TripLine line(UUID id,String source,Long manualId,String name,Double amount,String unit) {
        return new TripLine(id,source,manualId,null,name,amount,0,amount,unit,amount==null,List.of(),"NEEDED",null,null,false,null,null,amount,"OTHER");
    }
    @Transactional
    public TripView changeLine(String email,UUID id,UUID lineId,LineChange in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"trip-line:"+id+":"+lineId,in,TripView.class,()->{
            var t=owned(email,id);open(t,in.version());var d=read(t);
            if(d.lines().stream().noneMatch(l->l.id().equals(lineId))) throw error("Visit row unavailable",HttpStatus.NOT_FOUND);
            var rows=d.lines().stream().map(l->l.id().equals(lineId)?new TripLine(l.id(),l.source(),l.manualItemId(),l.requirementKey(),l.name(),l.needed(),l.fromHome(),l.toBuy(),l.unit(),l.needsReview(),l.slotIds(),in.state(),
                l.purchasedAmount(),l.purchasedUnit(),l.importToFridge(),l.importStatus(),l.actualPrice(),l.suggestedAmount(),l.department(),l.store(),l.packages()):l).toList();t.setStatus("IN_PROGRESS");return save(t,new TripDocument(rows,d.inventoryOperationId(),null));
        });
    }
    @Transactional
    public TripView addLine(String email,UUID id,AddLine in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"trip-add:"+id,in,TripView.class,()->{
            var t=owned(email,id);open(t,in.version());var d=read(t);if(d.lines().size()>=100) throw conflict("Visit contains 100 items.");
            if(in.amount()!=null&&(!Double.isFinite(in.amount())||in.amount()<=0)) throw error("Invalid amount",HttpStatus.BAD_REQUEST);
            var rows=new ArrayList<>(d.lines());rows.add(line(UUID.randomUUID(),"EXTRA",null,in.name().trim(),in.amount(),in.unit()));return save(t,new TripDocument(rows,d.inventoryOperationId(),null));
        });
    }
    @Transactional
    public TripView confirm(String email,UUID id,Confirm in) { return confirmInternal(email,id,in,false); }
    @Transactional
    public TripView retryImport(String email,UUID id,Confirm in) { return confirmInternal(email,id,in,true); }
    private TripView confirmInternal(String email,UUID id,Confirm in,boolean retry) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),(retry?"trip-retry:":"trip-confirm:")+id,in,TripView.class,()->{
            var t=owned(email,id);
            if(retry){s.version(t.getVersion(),in.version());if(!t.getStatus().equals("COMPLETED"))throw conflict("Complete this visit first.");}
            else open(t,in.version());
            var d=read(t);Map<UUID,Purchase> purchases=new HashMap<>();
            for(var p:in.purchases()) {
                if(p.amount()!=null&&(!Double.isFinite(p.amount())||p.amount()<=0)) throw error("Invalid purchase amount",HttpStatus.BAD_REQUEST);
                if(purchases.put(p.lineId(),p)!=null||d.lines().stream().noneMatch(l->l.id().equals(p.lineId())&&l.state().equals("IN_BASKET")&&(!retry||!"IMPORTED".equals(l.importStatus())))) throw error("Purchase must identify a basket row",HttpStatus.BAD_REQUEST);
            }
            List<FridgeInventoryChangeRequestDto> changes=new ArrayList<>();Map<UUID,String> statuses=new HashMap<>();
            for(var l:d.lines()) {
                var purchase=purchases.get(l.id());if(purchase==null||!purchase.importToFridge()) continue;
                if(units.normalize(purchase.unit()).isEmpty()) {statuses.put(l.id(),"SKIPPED_UNIT");continue;}
                var c=new FridgeInventoryChangeRequestDto();c.setClientChangeId(l.id().toString());c.setType(FridgeOperationChangeType.ADD);c.setName(l.name());c.setAmount(purchase.amount());c.setUnit(purchase.unit());
                c.setQuantityAccuracy(purchase.amount()==null?QuantityAccuracy.UNKNOWN:QuantityAccuracy.EXACT);changes.add(c);
            }
            List<String> operations=new ArrayList<>();
            if(retry&&d.inventoryOperationId()!=null&&!d.inventoryOperationId().isBlank()) operations.addAll(List.of(d.inventoryOperationId().split(",")));
            for(int offset=0;offset<changes.size();offset+=50) {
                var request=new FridgeInventoryOperationRequestDto();String operation=UUID.nameUUIDFromBytes(("trip:"+in.requestId()+":"+offset).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();operations.add(operation);
                request.setOperationId(operation);request.setSource(FridgeOperationSource.SHOPPING_LIST);request.setSourceReference(id.toString());request.setChanges(changes.subList(offset,Math.min(offset+50,changes.size())));
                var result=inventory.apply(request,email);result.getAppliedChanges().forEach(c->statuses.put(UUID.fromString(c.getClientChangeId()),"IMPORTED"));result.getSkippedChanges().forEach(c->statuses.put(UUID.fromString(c.getClientChangeId()),"SKIPPED_"+c.getReason()));
            }
            var rows=d.lines().stream().map(l->{var p=purchases.get(l.id());return p==null?l:new TripLine(l.id(),l.source(),l.manualItemId(),l.requirementKey(),l.name(),l.needed(),l.fromHome(),l.toBuy(),l.unit(),l.needsReview(),l.slotIds(),l.state(),
                p.amount(),p.unit(),p.importToFridge(),statuses.getOrDefault(l.id(),"NOT_IMPORTED"),p.actualPrice(),l.suggestedAmount(),l.department(),l.store(),l.packages());}).toList();
            var manualIds=rows.stream().filter(l->purchases.containsKey(l.id())&&l.manualItemId()!=null).map(TripLine::manualItemId).toList();
            manual.findByUserOrderByCreatedAtAsc(owner).stream().filter(i->manualIds.contains(i.getId())).forEach(i->i.setChecked(true));
            t.setStatus("COMPLETED");return save(t,new TripDocument(rows,String.join(",",operations),retry?d.completedAt():Instant.now()));
        });
    }
    @Transactional
    public TripView undoImport(String email,UUID id,Command in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"undo-trip-import:"+id,in,TripView.class,()->{
            var t=owned(email,id);s.version(t.getVersion(),in.version());var d=read(t);
            if(d.inventoryOperationId()==null||d.inventoryOperationId().isBlank()) throw conflict("This visit has no fridge import.");
            var operations=new ArrayList<>(List.of(d.inventoryOperationId().split(",")));Collections.reverse(operations);
            for(String op:operations) inventory.undo(op,UUID.nameUUIDFromBytes((in.requestId()+":"+op).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString(),email);
            var rows=d.lines().stream().map(l->new TripLine(l.id(),l.source(),l.manualItemId(),l.requirementKey(),l.name(),l.needed(),l.fromHome(),l.toBuy(),l.unit(),l.needsReview(),l.slotIds(),l.state(),l.purchasedAmount(),l.purchasedUnit(),l.importToFridge(),"IMPORTED".equals(l.importStatus())?"UNDONE":l.importStatus(),l.actualPrice(),l.suggestedAmount(),l.department(),l.store(),l.packages())).toList();
            return save(t,new TripDocument(rows,null,d.completedAt()));
        });
    }
}
