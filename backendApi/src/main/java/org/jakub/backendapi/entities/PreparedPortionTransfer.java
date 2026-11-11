package org.jakub.backendapi.entities;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="prepared_portion_transfer")
public class PreparedPortionTransfer {
    @Id private UUID id;
    @Column(nullable=false) private UUID sourcePlanId;
    @Column(nullable=false) private UUID batchId;
    @Column(nullable=false) private UUID targetPlanId;
    @Column(nullable=false) private UUID slotId;
    @Column(nullable=false) private int portions;
    @Column(nullable=false) private int eaten;
    @Column(nullable=false) private boolean released;
    @Column(nullable=false) private int discarded;
    public int getDiscarded(){return discarded;}public void setDiscarded(int v){discarded=v;}
    public UUID getId(){return id;}public void setId(UUID v){id=v;}
    public UUID getSourcePlanId(){return sourcePlanId;}public void setSourcePlanId(UUID v){sourcePlanId=v;}
    public UUID getBatchId(){return batchId;}public void setBatchId(UUID v){batchId=v;}
    public UUID getTargetPlanId(){return targetPlanId;}public void setTargetPlanId(UUID v){targetPlanId=v;}
    public UUID getSlotId(){return slotId;}public void setSlotId(UUID v){slotId=v;}
    public int getPortions(){return portions;}public void setPortions(int v){portions=v;}
    public int getEaten(){return eaten;}public void setEaten(int v){eaten=v;}
    public boolean isReleased(){return released;}public void setReleased(boolean v){released=v;}
}
