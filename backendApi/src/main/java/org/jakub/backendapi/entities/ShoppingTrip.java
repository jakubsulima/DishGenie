package org.jakub.backendapi.entities;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
@Entity @Table(name="shopping_trip")
public class ShoppingTrip {
    @Id private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id",nullable=false)
    @org.hibernate.annotations.OnDelete(action=org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User user;
    private UUID planId;
    @Version private long version;
    @Column(nullable=false) private String status;
    @Column(nullable=false) private Instant createdAt;
    @Column(nullable=false,columnDefinition="TEXT") private String document;
    public UUID getId(){return id;} public void setId(UUID v){id=v;}
    public User getUser(){return user;} public void setUser(User v){user=v;}
    public UUID getPlanId(){return planId;} public void setPlanId(UUID v){planId=v;}
    public long getVersion(){return version;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
    public String getDocument(){return document;} public void setDocument(String v){document=v;}
}
