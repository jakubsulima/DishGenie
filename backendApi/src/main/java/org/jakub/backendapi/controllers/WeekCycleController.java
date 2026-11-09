package org.jakub.backendapi.controllers;
import jakarta.validation.Valid;
import org.jakub.backendapi.dto.*;
import org.jakub.backendapi.dto.MealPlanDto.*;
import org.jakub.backendapi.dto.WeekCycleDto.*;
import org.jakub.backendapi.services.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import java.time.LocalDate;
import java.util.*;
@RestController
@RequestMapping("/v4")
public class WeekCycleController {
    private final WeekCycleService cycle; private final MealPlanJobService jobs; private final ShoppingTripService trips; private final MealPlanService plans; private final PreparedPortionService portions; private final ShoppingPreferencesService preferences;
    public WeekCycleController(WeekCycleService cycle,MealPlanJobService jobs,ShoppingTripService trips,MealPlanService plans,PreparedPortionService portions,ShoppingPreferencesService preferences){this.preferences=preferences;this.portions=portions;this.cycle=cycle;this.jobs=jobs;this.trips=trips;this.plans=plans;}
    private String email(Authentication a){return a.getPrincipal() instanceof UserDto u?u.getEmail():a.getName();}
    @PostMapping("/meal-plans/start") public Started start(Authentication a,@Valid @RequestBody Start input) {
        var created=cycle.create(email(a),input);
        try {jobs.start(email(a),created.view().id(),new Generate(created.view().version(),created.generationId()));}
        catch(org.jakub.backendapi.exceptions.AppException failure) {return new Started(plans.get(email(a),created.view().id()),null);}
        return new Started(plans.get(email(a),created.view().id()),created.generationId());
    }
    @GetMapping("/meal-plans/{id}/shopping-preview") public Shopping shopping(Authentication a,@PathVariable UUID id){return cycle.previewShopping(email(a),id);}
    @PostMapping("/meal-plans/{id}/change-previews") public ChangePreview preview(Authentication a,@PathVariable UUID id,@Valid @RequestBody BatchChange in){return cycle.preview(email(a),id,in);}
    @PostMapping("/meal-plans/{id}/apply-change") public View apply(Authentication a,@PathVariable UUID id,@Valid @RequestBody WeekCycleService.Apply in){return cycle.apply(email(a),id,in);}
    @GetMapping("/meal-plans/{id}/today") public Today today(Authentication a,@PathVariable UUID id,@RequestParam LocalDate date){return cycle.today(email(a),id,date);}
    @GetMapping("/meal-plans/{id}/batches/{batchId}/preview") public CookPreview cookPreview(Authentication a,@PathVariable UUID id,@PathVariable UUID batchId,@RequestParam(required=false) Integer portions){return cycle.cookingPreview(email(a),id,batchId,portions);}
    @PostMapping("/meal-plans/{id}/batches/{batchId}/cook") public View cook(Authentication a,@PathVariable UUID id,@PathVariable UUID batchId,@Valid @RequestBody Cook in){return cycle.cook(email(a),id,batchId,in);}
    @PostMapping("/meal-plans/{id}/batches/{batchId}/undo") public View undo(Authentication a,@PathVariable UUID id,@PathVariable UUID batchId,@Valid @RequestBody Command in){return cycle.undoCooking(email(a),id,batchId,in);}
    @PostMapping("/meal-plans/{id}/allocations/{slotId}/eat") public View eat(Authentication a,@PathVariable UUID id,@PathVariable UUID slotId,@Valid @RequestBody Eat in){return cycle.eat(email(a),id,slotId,in);}
    @PostMapping("/meal-plans/{id}/trips") public TripView prepare(Authentication a,@PathVariable UUID id,@Valid @RequestBody Prepare in){return trips.prepare(email(a),id,in);}
    @PostMapping("/shopping-trips") public TripView manualTrip(Authentication a,@Valid @RequestBody Prepare in){return trips.prepare(email(a),null,in);}
    @GetMapping("/shopping-trips") public List<TripView> list(Authentication a){return trips.list(email(a));}
    @GetMapping("/shopping-trips/pending-manual") public List<ShoppingTripService.ManualItem> pending(Authentication a){return trips.pending(email(a));}
    @GetMapping("/shopping-trips/{id}") public TripView get(Authentication a,@PathVariable UUID id){return trips.get(email(a),id);}
    @PostMapping("/shopping-trips/{id}/lines") public TripView add(Authentication a,@PathVariable UUID id,@Valid @RequestBody AddLine in){return trips.addLine(email(a),id,in);}
    @PostMapping("/shopping-trips/{id}/lines/{lineId}") public TripView line(Authentication a,@PathVariable UUID id,@PathVariable UUID lineId,@Valid @RequestBody LineChange in){return trips.changeLine(email(a),id,lineId,in);}
    @PostMapping("/shopping-trips/{id}/confirm") public TripView confirm(Authentication a,@PathVariable UUID id,@Valid @RequestBody Confirm in){return trips.confirm(email(a),id,in);}
    @PostMapping("/shopping-trips/{id}/retry-import") public TripView retryImport(Authentication a,@PathVariable UUID id,@Valid @RequestBody Confirm in){return trips.retryImport(email(a),id,in);}
    @PostMapping("/shopping-trips/{id}/undo-import") public TripView undoImport(Authentication a,@PathVariable UUID id,@Valid @RequestBody Command in){return trips.undoImport(email(a),id,in);}
    @PostMapping("/meal-plans/{id}/ready-portions") public View assign(Authentication a,@PathVariable UUID id,@Valid @RequestBody PreparedPortionService.Assign in){return portions.assign(email(a),id,in);}
    @GetMapping("/ready-portions") public List<WeekCycleService.ReadyPortions> ready(Authentication a){return cycle.readyPortions(email(a));}
    @GetMapping("/meal-plans/{id}/resources") public WeekCycleService.Resources resources(Authentication a,@PathVariable UUID id){return cycle.resources(email(a),id);}
    @PostMapping("/meal-plans/{id}/inventory-reviewed") public View reviewed(Authentication a,@PathVariable UUID id,@Valid @RequestBody WeekCycleService.Reviewed in){return cycle.reviewed(email(a),id,in);}

    public record RememberedSettings(Create settings,boolean cyclePreferences) {}
    @GetMapping("/shopping-preferences") public RememberedSettings preferences(Authentication a) {
        var settings=preferences.get(email(a));boolean modern=false;
        if(settings!=null)try{modern=plans.get(email(a),settings.requestId()).plan().schemaVersion()>=4;}catch(org.jakub.backendapi.exceptions.AppException ignored){/* Preferences can outlive a removed plan. */}
        return new RememberedSettings(settings,modern);
    }

}
