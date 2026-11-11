package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.WeekCycleDto.*;
import org.jakub.backendapi.repositories.*;
import org.jakub.backendapi.entities.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.constraints.*;
import java.util.*;
import static org.jakub.backendapi.services.WeekCycleSupport.*;
@Service
public class PreparedPortionService {
    private final WeekCycleSupport s;private final PreparedPortionTransferRepository transfers;
    public PreparedPortionService(WeekCycleSupport s,PreparedPortionTransferRepository transfers){this.s=s;this.transfers=transfers;}
    public record Assign(@Min(0) long version,@NotNull UUID requestId,@NotNull UUID sourcePlanId,@Min(0) long sourceVersion,@NotNull UUID batchId,@NotNull UUID slotId,@Min(1) @Max(100) int portions) {}
    @Transactional
    public View assign(String email,UUID targetId,Assign in) {
        var owner=s.owner(email);return s.once(owner,in.requestId(),"ready-portion:"+targetId,in,View.class,()->{
            var source=s.owned(email,in.sourcePlanId());var target=s.owned(email,targetId);s.version(source.getVersion(),in.sourceVersion());s.version(target.getVersion(),in.version());
            var sourceDoc=s.read(source);var targetDoc=s.read(target);s.idle(targetDoc);var batch=s.batch(sourceDoc,in.batchId());var slot=s.slot(targetDoc,in.slotId());
            if(!batch.status().equals("COOKED")||"DISCARDED".equals(batch.storage())||transfers.existsById(batch.id()))throw conflict("Choose the original available cooking.");
            if(slot.locked()||slot.recipe()!=null&&!slot.skipped()||slot.date().isBefore(batch.cookingDate()))throw conflict("Choose an empty meal after cooking.");
            int free=unallocated(source.getId(),batch);if(in.portions()>free)throw conflict("These portions are already allocated.");
            var transfer=new PreparedPortionTransfer();transfer.setId(UUID.randomUUID());transfer.setSourcePlanId(source.getId());transfer.setBatchId(batch.id());transfer.setTargetPlanId(targetId);transfer.setSlotId(slot.id());transfer.setPortions(in.portions());transfers.saveAndFlush(transfer);
            var batches=new ArrayList<>(s.batches(targetDoc));batches.add(new Batch(transfer.getId(),batch.cookingDate(),batch.recipe(),in.portions(),"COOKED",List.of(new Allocation(slot.id(),in.portions(),"PLANNED")),null,batch.inventoryReview(),batch.storage()));
            var slots=targetDoc.slots().stream().map(old->old.id().equals(slot.id())?new Slot(slot.id(),slot.date(),slot.mealType(),in.portions(),false,false,batch.recipe(),null,null,null):old).toList();
            if(!source.getId().equals(targetId)){source.markCycleChanged();s.repository.saveAndFlush(source);}
            return s.save(target,s.withBatches(targetDoc,slots,batches,s.cycle(targetDoc).inventoryReview()));
        });
    }
    public int unallocated(UUID planId,Batch b) {return b.portions()-b.allocations().stream().mapToInt(Allocation::portions).sum()-transfers.findBySourcePlanIdAndBatchIdAndReleasedFalse(planId,b.id()).stream().mapToInt(PreparedPortionTransfer::getPortions).sum();}
    public int eatenElsewhere(UUID planId,Batch b) {return transfers.findBySourcePlanIdAndBatchIdAndReleasedFalse(planId,b.id()).stream().mapToInt(t->t.getEaten()+t.getDiscarded()).sum();}
    public boolean isTransfer(UUID batchId){return transfers.existsById(batchId);}
    public void protectOriginal(UUID planId,UUID batchId) {if(!transfers.findBySourcePlanIdAndBatchIdAndReleasedFalse(planId,batchId).isEmpty())throw conflict("Portions in another meal depend on this cooking. Release them first.");}
    public void reconcile(String email,UUID targetId,Document after) {
        for(var transfer:transfers.findByTargetPlanIdAndReleasedFalse(targetId)) {
            var b=after.cycle().batches().stream().filter(batch->batch.id().equals(transfer.getId())).findFirst().orElseThrow(()->conflict("Transferred portions cannot disappear."));
            var allocation=b.allocations().stream().filter(a->!a.status().equals("SKIPPED")).findFirst();
            if(allocation.isEmpty()) {if(transfer.getEaten()+transfer.getDiscarded()>0)throw conflict("Eaten portions cannot be released.");transfer.setReleased(true);}
            else {var a=allocation.get();if(a.portions()!=transfer.getPortions())throw conflict("Change transferred portions by releasing and assigning them again.");transfer.setSlotId(a.slotId());transfer.setEaten(a.eatenPortions());transfer.setDiscarded("DISCARDED".equals(b.storage())?transfer.getPortions()-transfer.getEaten():0);}
            var source=s.owned(email,transfer.getSourcePlanId());if(!source.getId().equals(targetId)){source.markCycleChanged();s.repository.saveAndFlush(source);}
        }
    }
}
