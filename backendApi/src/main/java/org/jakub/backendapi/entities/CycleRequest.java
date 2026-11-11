package org.jakub.backendapi.entities;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
@Entity @Table(name="cycle_request")
public class CycleRequest {
    @Id private UUID id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id",nullable=false)
    @org.hibernate.annotations.OnDelete(action=org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User user;
    @Column(nullable=false,columnDefinition="TEXT") private String input;
    @Column(columnDefinition="TEXT") private String result;
    @Column(nullable=false) private Instant createdAt;
    public UUID getId(){return id;} public void setId(UUID v){id=v;}
    public User getUser(){return user;} public void setUser(User v){user=v;}
    public String getInput(){return input;} public void setInput(String v){input=v;}
    public String getResult(){return result;} public void setResult(String v){result=v;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
}
