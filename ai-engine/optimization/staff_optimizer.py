"""
Staff Optimization using OR-Tools CP-SAT Solver
Optimizes staff allocation to counters based on queue load and constraints
"""

from ortools.sat.python import cp_model
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import numpy as np
from datetime import datetime, timedelta

from .constraints import (
    ConstraintValidator, 
    OptimizationRules, 
    StaffingConstraints,
    DEFAULT_VALIDATOR,
    DEFAULT_RULES
)


def optimize_staff(
    counts: Dict[str, int],
    current_staff: Dict[str, int],
    predicted_counts: Optional[Dict[str, int]] = None,
    cooldown_counters: Optional[Dict[str, int]] = None,
) -> Dict[str, Dict[str, object]]:
    """
    Compare queue load vs current staffing for each counter.

    Rule of thumb: 1 staff member can handle 5 people.
    If predicted_counts is provided, recommendations use predicted load.
    cooldown_counters can be used to prevent frequent switching for counters
    with an active cooldown (value > 0).
    """
    load_counts = predicted_counts if predicted_counts is not None else counts
    mode = "predicted" if predicted_counts is not None else "real-time"
    cooldown_counters = cooldown_counters or {}

    result: Dict[str, Dict[str, object]] = {}
    counter_ids = sorted(set(load_counts.keys()) | set(current_staff.keys()))
    movement_notes: Dict[str, List[str]] = {counter_id: [] for counter_id in counter_ids}
    overloaded: List[Dict[str, object]] = []
    underutilized: List[Dict[str, object]] = []

    for counter_id in counter_ids:
        people_count = load_counts.get(counter_id, 0)
        assigned_staff = current_staff.get(counter_id, 0)
        required_staff = (people_count + 4) // 5
        score = people_count / max(1, assigned_staff)
        is_critical = people_count >= 15
        cooldown_active = cooldown_counters.get(counter_id, 0) > 0

        if required_staff > assigned_staff:
            status = "OVERLOADED"
            action = "Add"
            overloaded.append({
                "counter_id": counter_id,
                "needed": required_staff - assigned_staff,
                "score": score,
                "people_count": people_count,
                "critical": is_critical,
                "cooldown": cooldown_active,
            })
        elif required_staff < assigned_staff:
            status = "UNDERUTILIZED"
            action = "Remove"
            surplus = assigned_staff - required_staff
            movable = max(0, min(surplus, assigned_staff - 1))
            underutilized.append({
                "counter_id": counter_id,
                "movable": movable,
                "score": score,
                "people_count": people_count,
                "cooldown": cooldown_active,
            })
        else:
            status = "OK"
            action = "No Change"

        result[counter_id] = {
            "mode": mode,
            "status": status,
            "score": round(score, 2),
            "required_staff": required_staff,
            "action": action,
            "recommendation": "No movement suggested",
        }

        if cooldown_active:
            result[counter_id]["recommendation"] = "Cooldown active - hold current staffing"

    # Prioritize highest-risk counters first.
    overloaded.sort(
        key=lambda item: (
            item["critical"],
            item["score"],
            item["people_count"],
        ),
        reverse=True,
    )
    # Prefer moving from lowest-load counters first.
    underutilized.sort(
        key=lambda item: (item["score"], item["people_count"])
    )

    # Greedy matching: move staff from underutilized counters to overloaded counters.
    for target in overloaded:
        target_id = target["counter_id"]
        needed = target["needed"]

        # Avoid frequent switching for counters with active cooldown.
        if target["cooldown"]:
            continue

        for source in underutilized:
            if needed <= 0:
                break

            source_id = source["counter_id"]
            movable = source["movable"]

            if source["cooldown"]:
                continue

            while needed > 0 and movable > 0:
                recommendation = f"Move 1 staff from Counter {source_id} to Counter {target_id}"
                movement_notes[source_id].append(recommendation)
                movement_notes[target_id].append(recommendation)
                needed -= 1
                movable -= 1

            source["movable"] = movable

    for counter_id in counter_ids:
        if movement_notes[counter_id]:
            result[counter_id]["recommendation"] = "; ".join(movement_notes[counter_id])

    return result


def dynamic_staff_allocation(
    counts: Dict[str, int],
    staff: List[Dict[str, object]],
    predicted_counts: Optional[Dict[str, int]] = None,
    people_per_staff: int = 5,
    min_staff_per_counter: int = 1,
    cooldown_seconds: int = 120,
    last_moved_at: Optional[Dict[str, object]] = None,
    now_ts: Optional[float] = None,
    debug: bool = True,
) -> Dict[str, object]:
    """
    Dynamic staff allocation from detailed staff list.

    Input staff item shape:
    {
        "id": "S1",
        "current_counter": "1",
        "status": "active|available|break"
    }
    """
    if people_per_staff <= 0:
        raise ValueError("people_per_staff must be > 0")

    if min_staff_per_counter < 0:
        raise ValueError("min_staff_per_counter must be >= 0")

    def _log(msg: str) -> None:
        if debug:
            print(f"[dynamic-allocation] {msg}")

    def _as_epoch(value: object) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
            except ValueError:
                return None
        return None

    now_epoch = float(now_ts) if now_ts is not None else datetime.now().timestamp()
    last_moved_at = last_moved_at or {}
    last_moved_epoch: Dict[str, float] = {}
    for sid, ts in last_moved_at.items():
        parsed = _as_epoch(ts)
        if parsed is not None:
            last_moved_epoch[str(sid)] = parsed

    load_counts = predicted_counts if predicted_counts is not None else counts
    mode = "predicted" if predicted_counts is not None else "real-time"
    _log(f"mode={mode}, people_per_staff={people_per_staff}, min_staff_per_counter={min_staff_per_counter}")

    counter_ids = sorted({str(k) for k in counts.keys()} | {str(k) for k in load_counts.keys()})
    if not counter_ids:
        counter_ids = sorted(
            {
                str(s.get("current_counter"))
                for s in staff
                if s.get("current_counter") not in (None, "", "null")
            }
        )

    required_staff: Dict[str, int] = {}
    for counter_id in counter_ids:
        queue_size = int(load_counts.get(counter_id, counts.get(counter_id, 0)) or 0)
        needed = (queue_size + people_per_staff - 1) // people_per_staff
        required_staff[counter_id] = max(min_staff_per_counter, needed)
        _log(f"counter={counter_id} queue={queue_size} required={required_staff[counter_id]}")

    allocation: Dict[str, List[str]] = {counter_id: [] for counter_id in counter_ids}
    staff_status: Dict[str, str] = {}
    free_pool: List[str] = []

    assignable_status = {"active", "available"}

    for member in staff:
        sid = str(member.get("id", "")).strip()
        if not sid:
            continue

        status = str(member.get("status", "available")).strip().lower()
        current_counter = member.get("current_counter")
        current_counter_id = str(current_counter).strip() if current_counter not in (None, "") else None
        staff_status[sid] = status

        if status not in assignable_status:
            _log(f"staff={sid} status={status} skipped (not assignable)")
            continue

        if current_counter_id and current_counter_id in allocation:
            allocation[current_counter_id].append(sid)
        else:
            free_pool.append(sid)

    recommendations: List[str] = []

    # Fill counters with 0 staff first using free pool so every counter keeps baseline coverage.
    for counter_id in counter_ids:
        while len(allocation[counter_id]) < min_staff_per_counter and free_pool:
            sid = free_pool.pop(0)
            allocation[counter_id].append(sid)
            recommendations.append(f"Assign {sid} to Counter {counter_id} (baseline coverage)")
            _log(f"baseline assign: {sid} -> {counter_id}")

    def _movable_from_counter(counter_id: str) -> List[str]:
        movable: List[str] = []
        current = allocation[counter_id]
        required = required_staff[counter_id]
        surplus = max(0, len(current) - required)
        if surplus <= 0:
            return movable

        for sid in current:
            last_move = last_moved_epoch.get(sid)
            if last_move is not None and (now_epoch - last_move) < cooldown_seconds:
                continue
            movable.append(sid)
            if len(movable) >= surplus:
                break

        return movable

    # Move staff into overloaded counters.
    targets = sorted(
        counter_ids,
        key=lambda cid: (required_staff[cid] - len(allocation[cid]), int(load_counts.get(cid, counts.get(cid, 0)) or 0)),
        reverse=True,
    )

    for target_id in targets:
        deficit = required_staff[target_id] - len(allocation[target_id])
        if deficit <= 0:
            continue

        _log(f"target counter={target_id} deficit={deficit}")

        # Use free staff first (no counter to move from).
        while deficit > 0 and free_pool:
            sid = free_pool.pop(0)
            allocation[target_id].append(sid)
            last_moved_epoch[sid] = now_epoch
            recommendations.append(f"Assign {sid} to Counter {target_id}")
            _log(f"free staff assign: {sid} -> {target_id}")
            deficit -= 1

        if deficit <= 0:
            continue

        sources = sorted(
            counter_ids,
            key=lambda cid: (len(allocation[cid]) - required_staff[cid], -(int(load_counts.get(cid, counts.get(cid, 0)) or 0))),
            reverse=True,
        )

        for source_id in sources:
            if deficit <= 0:
                break
            if source_id == target_id:
                continue

            movable = _movable_from_counter(source_id)
            if not movable:
                continue

            for sid in movable:
                if deficit <= 0:
                    break
                allocation[source_id].remove(sid)
                allocation[target_id].append(sid)
                last_moved_epoch[sid] = now_epoch
                recommendations.append(f"Move {sid} from Counter {source_id} -> Counter {target_id}")
                _log(f"move: {sid} {source_id}->{target_id}")
                deficit -= 1

        if deficit > 0:
            msg = f"Counter {target_id} still needs {deficit} staff (insufficient movable staff)"
            recommendations.append(msg)
            _log(msg)

    status: Dict[str, str] = {}
    for counter_id in counter_ids:
        assigned = len(allocation[counter_id])
        needed = required_staff[counter_id]
        if assigned < needed:
            status[counter_id] = "OVERLOADED"
        elif assigned > needed:
            status[counter_id] = "UNDERUTILIZED"
        else:
            status[counter_id] = "OK"
        _log(f"final counter={counter_id} assigned={assigned} needed={needed} status={status[counter_id]}")

    serializable_last_moved = {
        sid: datetime.fromtimestamp(ts).isoformat()
        for sid, ts in last_moved_epoch.items()
    }

    return {
        "allocation": allocation,
        "status": status,
        "recommendations": recommendations,
        "mode": mode,
        "required_staff": required_staff,
        "last_moved_at": serializable_last_moved,
    }


@dataclass
class StaffMember:
    """Represents a staff member with their attributes"""
    id: int
    name: str
    skill_level: str  # 'basic', 'intermediate', 'advanced'
    skills: List[str]  # e.g., ['registration', 'billing']
    available_slots: List[int]  # Time slots when staff is available
    max_hours: float = 8.0  # Maximum hours per day
    hourly_rate: float = 15.0


@dataclass
class Counter:
    """Represents a service counter"""
    id: int
    counter_type: str  # 'registration', 'consultation', etc.
    max_capacity: int  # Maximum staff at this counter
    priority: int = 1  # Higher number = higher priority


@dataclass
class OptimizationInput:
    """Input data for optimization"""
    staff: List[StaffMember]
    counters: List[Counter]
    current_queue_load: Dict[str, int]  # counter_type -> queue_load
    predicted_queue_load: Dict[str, int]  # counter_type -> predicted_load
    time_slots: List[int]  # Time slots to optimize (e.g., [0, 1, 2, ...])
    budget: float = 5000.0  # Daily budget


@dataclass
class StaffAssignment:
    """Output: Staff assignment to counter and time slot"""
    staff_id: int
    staff_name: str
    counter_id: int
    counter_type: str
    start_slot: int
    end_slot: int
    start_time: str
    end_time: str
    duration_hours: float
    cost: float


@dataclass
class OptimizationOutput:
    """Output from optimization"""
    assignments: List[StaffAssignment]
    total_cost: float
    staff_utilization: Dict[int, float]  # staff_id -> utilization %
    counter_coverage: Dict[str, List[int]]  # counter_type -> [staff_count per slot]
    recommendations: List[Dict]
    status: str  # 'optimal', 'feasible', 'infeasible'
    solve_time: float


class StaffOptimizer:
    """CP-SAT based staff optimizer"""
    
    def __init__(self, 
                 validator: ConstraintValidator = None,
                 rules: OptimizationRules = None,
                 constraints_config: StaffingConstraints = None):
        self.validator = validator or DEFAULT_VALIDATOR
        self.rules = rules or DEFAULT_RULES
        self.config = constraints_config or StaffingConstraints()
        self.model = None
        self.solver = None
    
    def optimize(self, input_data: OptimizationInput) -> OptimizationOutput:
        """
        Main optimization function
        
        Args:
            input_data: Optimization input data
            
        Returns:
            OptimizationOutput with assignments and recommendations
        """
        start_time = datetime.now()
        
        # Create CP-SAT model
        self.model = cp_model.CpModel()
        
        # Decision variables
        assignment_vars = self._create_variables(input_data)
        
        # Add constraints
        self._add_constraints(input_data, assignment_vars)
        
        # Set objective
        self._set_objective(input_data, assignment_vars)
        
        # Solve
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = 30.0
        status = self.solver.Solve(self.model)
        
        solve_time = (datetime.now() - start_time).total_seconds()
        
        # Extract solution
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return self._extract_solution(input_data, assignment_vars, status, solve_time)
        else:
            return self._create_empty_output(status, solve_time)
    
    def _create_variables(self, input_data: OptimizationInput) -> Dict:
        """Create decision variables for CP-SAT"""
        variables = {
            'assignment': {},  # assignment[staff_id][counter_id][slot] = 0/1
            'shift_start': {},  # shift_start[staff_id] = slot number
            'shift_end': {},    # shift_end[staff_id] = slot number
            'working': {}       # working[staff_id] = 0/1
        }
        
        # Assignment variables: staff i assigned to counter j at time slot t
        for staff in input_data.staff:
            variables['assignment'][staff.id] = {}
            for counter in input_data.counters:
                variables['assignment'][staff.id][counter.id] = {}
                for slot in input_data.time_slots:
                    var_name = f'assign_s{staff.id}_c{counter.id}_t{slot}'
                    variables['assignment'][staff.id][counter.id][slot] = \
                        self.model.NewBoolVar(var_name)
        
        # Shift start and end times
        max_slot = max(input_data.time_slots)
        for staff in input_data.staff:
            variables['shift_start'][staff.id] = self.model.NewIntVar(
                0, max_slot, f'start_s{staff.id}'
            )
            variables['shift_end'][staff.id] = self.model.NewIntVar(
                0, max_slot + 1, f'end_s{staff.id}'
            )
            variables['working'][staff.id] = self.model.NewBoolVar(f'working_s{staff.id}')
        
        return variables
    
    def _add_constraints(self, input_data: OptimizationInput, variables: Dict):
        """Add all constraints to the model"""
        
        # 1. Staff can work at most one counter per time slot
        for staff in input_data.staff:
            for slot in input_data.time_slots:
                counter_assignments = [
                    variables['assignment'][staff.id][counter.id][slot]
                    for counter in input_data.counters
                ]
                self.model.Add(sum(counter_assignments) <= 1)
        
        # 2. Staff availability constraints
        for staff in input_data.staff:
            for slot in input_data.time_slots:
                if slot not in staff.available_slots:
                    # Force no assignment if staff not available
                    for counter in input_data.counters:
                        self.model.Add(
                            variables['assignment'][staff.id][counter.id][slot] == 0
                        )
        
        # 3. Skill matching constraints
        for staff in input_data.staff:
            for counter in input_data.counters:
                if not self.validator.validate_skill_for_counter(
                    staff.skills, counter.counter_type
                ):
                    # Staff doesn't have required skills for this counter
                    for slot in input_data.time_slots:
                        self.model.Add(
                            variables['assignment'][staff.id][counter.id][slot] == 0
                        )
        
        # 4. Counter capacity constraints
        for counter in input_data.counters:
            max_capacity = self.validator.get_counter_capacity(counter.counter_type)
            for slot in input_data.time_slots:
                staff_at_counter = [
                    variables['assignment'][staff.id][counter.id][slot]
                    for staff in input_data.staff
                ]
                self.model.Add(sum(staff_at_counter) <= max_capacity)
        
        # 5. NOTE: Do not hard-enforce minimum staff per counter.
        # In constrained real-world scenarios (few available staff), hard minimums can make
        # the model infeasible. Under-staffing is instead penalized in the objective.
        
        # 6. Shift duration constraints
        horizon_slots = len(input_data.time_slots)
        for staff in input_data.staff:
            # If working, enforce minimum and maximum shift duration
            min_slots_cfg = int(self.config.MIN_SHIFT_HOURS * self.config.TIME_SLOTS_PER_HOUR)
            max_slots_cfg = int(self.config.MAX_SHIFT_HOURS * self.config.TIME_SLOTS_PER_HOUR)

            # Adapt to the provided optimization horizon (backend currently sends 8 slots: 0..7).
            min_slots = max(1, min(min_slots_cfg, horizon_slots))
            max_slots = max(1, min(max_slots_cfg, horizon_slots))
            
            # shift_duration = shift_end - shift_start
            shift_duration = self.model.NewIntVar(0, horizon_slots, f'duration_s{staff.id}')
            self.model.Add(
                shift_duration == variables['shift_end'][staff.id] - 
                variables['shift_start'][staff.id]
            )
            
            # If working, enforce duration limits
            self.model.Add(shift_duration >= min_slots).OnlyEnforceIf(
                variables['working'][staff.id]
            )
            self.model.Add(shift_duration <= max_slots).OnlyEnforceIf(
                variables['working'][staff.id]
            )
            
            # If not working, duration should be 0
            self.model.Add(shift_duration == 0).OnlyEnforceIf(
                variables['working'][staff.id].Not()
            )
        
        # 7. Continuous shift constraint (if assigned, must be continuous)
        for staff in input_data.staff:
            for slot in input_data.time_slots:
                # If assigned at this slot, must be within shift times
                for counter in input_data.counters:
                    assigned = variables['assignment'][staff.id][counter.id][slot]
                    
                    # slot >= shift_start AND slot < shift_end
                    self.model.Add(
                        slot >= variables['shift_start'][staff.id]
                    ).OnlyEnforceIf(assigned)
                    
                    self.model.Add(
                        slot < variables['shift_end'][staff.id]
                    ).OnlyEnforceIf(assigned)
        
        # 8. Working flag consistency
        for staff in input_data.staff:
            # If any assignment exists, working = 1
            all_assignments = [
                variables['assignment'][staff.id][counter.id][slot]
                for counter in input_data.counters
                for slot in input_data.time_slots
            ]
            
            # working implies at least one assignment
            self.model.Add(sum(all_assignments) > 0).OnlyEnforceIf(
                variables['working'][staff.id]
            )
    
    def _set_objective(self, input_data: OptimizationInput, variables: Dict):
        """Set optimization objective"""
        
        # Multi-objective: minimize cost and maximize coverage
        objective_terms = []
        
        # 1. Minimize total cost
        for staff in input_data.staff:
            # Cost = hourly_rate * (shift_duration / slots_per_hour)
            shift_duration = (variables['shift_end'][staff.id] - 
                            variables['shift_start'][staff.id])
            
            # Convert to cost (scaled to avoid floating point)
            cost_per_slot = int(staff.hourly_rate / self.config.TIME_SLOTS_PER_HOUR * 100)
            objective_terms.append(cost_per_slot * shift_duration)
        
        # 2. Maximize coverage (minimize uncovered slots) - weighted heavily
        for counter in input_data.counters:
            current_load = input_data.current_queue_load.get(counter.counter_type, 0)
            predicted_load = input_data.predicted_queue_load.get(counter.counter_type, 0)
            max_load = max(current_load, predicted_load)
            required_staff = self.validator.get_min_staff_for_load(max_load)
            
            for slot in input_data.time_slots:
                staff_at_counter = [
                    variables['assignment'][staff.id][counter.id][slot]
                    for staff in input_data.staff
                ]
                
                # Penalty for under-staffing (weighted by priority)
                coverage_deficit = self.model.NewIntVar(
                    0, len(input_data.staff),
                    f'deficit_c{counter.id}_t{slot}'
                )

                # coverage_deficit = max(0, required_staff - assigned_staff)
                self.model.Add(coverage_deficit >= required_staff - sum(staff_at_counter))
                self.model.Add(coverage_deficit >= 0)
                
                # Heavy penalty for under-staffing (priority * 10000)
                penalty = counter.priority * 10000
                objective_terms.append(penalty * coverage_deficit)
        
        # Minimize total objective
        self.model.Minimize(sum(objective_terms))
    
    def _extract_solution(self, 
                         input_data: OptimizationInput,
                         variables: Dict,
                         status: int,
                         solve_time: float) -> OptimizationOutput:
        """Extract solution from solved model"""
        
        assignments = []
        staff_utilization = {}
        counter_coverage = {counter.counter_type: [0] * len(input_data.time_slots) 
                           for counter in input_data.counters}
        total_cost = 0.0
        
        for staff in input_data.staff:
            if self.solver.Value(variables['working'][staff.id]) == 1:
                start_slot = self.solver.Value(variables['shift_start'][staff.id])
                end_slot = self.solver.Value(variables['shift_end'][staff.id])
                
                # Find which counter(s) staff is assigned to
                for counter in input_data.counters:
                    for slot in range(start_slot, end_slot):
                        if slot in input_data.time_slots:
                            if self.solver.Value(
                                variables['assignment'][staff.id][counter.id][slot]
                            ) == 1:
                                # Create assignment (group consecutive slots)
                                duration_hours = (end_slot - start_slot) / \
                                               self.config.TIME_SLOTS_PER_HOUR
                                cost = staff.hourly_rate * duration_hours
                                
                                assignment = StaffAssignment(
                                    staff_id=staff.id,
                                    staff_name=staff.name,
                                    counter_id=counter.id,
                                    counter_type=counter.counter_type,
                                    start_slot=start_slot,
                                    end_slot=end_slot,
                                    start_time=self.validator.time_slot_to_time(start_slot),
                                    end_time=self.validator.time_slot_to_time(end_slot),
                                    duration_hours=duration_hours,
                                    cost=cost
                                )
                                
                                # Only add unique assignments
                                if not any(a.staff_id == assignment.staff_id and 
                                         a.counter_id == assignment.counter_id
                                         for a in assignments):
                                    assignments.append(assignment)
                                    total_cost += cost
                                
                                # Update coverage
                                counter_coverage[counter.counter_type][slot] += 1
                                break  # Staff found for this slot
                
                # Calculate utilization
                worked_slots = end_slot - start_slot
                max_slots = staff.max_hours * self.config.TIME_SLOTS_PER_HOUR
                staff_utilization[staff.id] = (worked_slots / max_slots) * 100
            else:
                staff_utilization[staff.id] = 0.0
        
        # Generate recommendations
        recommendations = []
        for counter_type, loads in counter_coverage.items():
            avg_coverage = np.mean(loads)
            min_coverage = np.min(loads)
            
            current_load = input_data.current_queue_load.get(counter_type, 0)
            predicted_load = input_data.predicted_queue_load.get(counter_type, 0)
            
            rec = self.rules.generate_staffing_recommendations(
                current_load, predicted_load, int(avg_coverage)
            )
            rec['counter_type'] = counter_type
            rec['average_coverage'] = avg_coverage
            rec['minimum_coverage'] = min_coverage
            recommendations.append(rec)
        
        status_str = 'optimal' if status == cp_model.OPTIMAL else 'feasible'
        
        return OptimizationOutput(
            assignments=assignments,
            total_cost=total_cost,
            staff_utilization=staff_utilization,
            counter_coverage=counter_coverage,
            recommendations=recommendations,
            status=status_str,
            solve_time=solve_time
        )
    
    def _create_empty_output(self, status: int, solve_time: float) -> OptimizationOutput:
        """Create empty output for infeasible problems"""
        return OptimizationOutput(
            assignments=[],
            total_cost=0.0,
            staff_utilization={},
            counter_coverage={},
            recommendations=[{
                'status': 'error',
                'message': 'No feasible solution found. Check constraints.',
                'action': 'review_requirements'
            }],
            status='infeasible',
            solve_time=solve_time
        )
    
    def format_output_summary(self, output: OptimizationOutput) -> str:
        """Format optimization output as readable summary"""
        
        lines = []
        lines.append("=" * 60)
        lines.append("STAFF OPTIMIZATION RESULTS")
        lines.append("=" * 60)
        lines.append(f"Status: {output.status.upper()}")
        lines.append(f"Solve Time: {output.solve_time:.2f} seconds")
        lines.append(f"Total Cost: ${output.total_cost:.2f}")
        lines.append("")
        
        if output.assignments:
            lines.append("STAFF ASSIGNMENTS:")
            lines.append("-" * 60)
            for assignment in output.assignments:
                lines.append(
                    f"  {assignment.staff_name} (ID: {assignment.staff_id})"
                )
                lines.append(
                    f"    Counter: {assignment.counter_type}"
                )
                lines.append(
                    f"    Shift: {assignment.start_time} - {assignment.end_time} "
                    f"({assignment.duration_hours:.1f} hours)"
                )
                lines.append(f"    Cost: ${assignment.cost:.2f}")
                lines.append("")
        
        if output.recommendations:
            lines.append("RECOMMENDATIONS:")
            lines.append("-" * 60)
            for rec in output.recommendations:
                if 'counter_type' in rec:
                    lines.append(f"  {rec['counter_type'].upper()}:")
                    lines.append(f"    Status: {rec['status']}")
                    lines.append(f"    Action: {rec['action']}")
                    lines.append(f"    Priority: {rec['priority']}")
                    if rec.get('deficit', 0) > 0:
                        lines.append(f"    Staff Deficit: {rec['deficit']}")
                    lines.append("")
        
        lines.append("=" * 60)
        return "\n".join(lines)


def create_sample_optimization():
    """Create sample optimization scenario for testing"""
    
    # Sample staff
    staff = [
        StaffMember(
            id=1, name="Alice", skill_level="advanced",
            skills=["medical", "emergency"], 
            available_slots=list(range(32, 64)),  # 8:00 - 16:00
            hourly_rate=40.0
        ),
        StaffMember(
            id=2, name="Bob", skill_level="intermediate",
            skills=["registration", "billing"],
            available_slots=list(range(24, 56)),  # 6:00 - 14:00
            hourly_rate=25.0
        ),
        StaffMember(
            id=3, name="Carol", skill_level="intermediate",
            skills=["pharmacy", "billing"],
            available_slots=list(range(32, 64)),  # 8:00 - 16:00
            hourly_rate=25.0
        ),
        StaffMember(
            id=4, name="Dave", skill_level="basic",
            skills=["registration", "basic"],
            available_slots=list(range(40, 72)),  # 10:00 - 18:00
            hourly_rate=15.0
        ),
        StaffMember(
            id=5, name="Eve", skill_level="advanced",
            skills=["lab_tech", "medical"],
            available_slots=list(range(28, 60)),  # 7:00 - 15:00
            hourly_rate=40.0
        ),
    ]
    
    # Sample counters
    counters = [
        Counter(id=1, counter_type="registration", max_capacity=3, priority=2),
        Counter(id=2, counter_type="consultation", max_capacity=4, priority=3),
        Counter(id=3, counter_type="pharmacy", max_capacity=2, priority=2),
        Counter(id=4, counter_type="laboratory", max_capacity=3, priority=2),
    ]
    
    # Sample loads
    current_load = {
        "registration": 15,
        "consultation": 25,
        "pharmacy": 12,
        "laboratory": 8
    }
    
    predicted_load = {
        "registration": 20,
        "consultation": 35,
        "pharmacy": 18,
        "laboratory": 15
    }
    
    # Time slots (8:00 - 16:00)
    time_slots = list(range(32, 64))
    
    return OptimizationInput(
        staff=staff,
        counters=counters,
        current_queue_load=current_load,
        predicted_queue_load=predicted_load,
        time_slots=time_slots,
        budget=2000.0
    )


if __name__ == "__main__":
    print("Staff Optimizer - OR-Tools CP-SAT")
    print("=" * 60)
    
    # Create sample scenario
    input_data = create_sample_optimization()
    
    print(f"\nOptimizing for {len(input_data.staff)} staff members")
    print(f"Across {len(input_data.counters)} counters")
    print(f"Time slots: {len(input_data.time_slots)}")
    print(f"Budget: ${input_data.budget}")
    print("\nSolving...")
    
    # Run optimization
    optimizer = StaffOptimizer()
    output = optimizer.optimize(input_data)
    
    # Print results
    print("\n" + optimizer.format_output_summary(output))
    
    # Print utilization
    print("\nSTAFF UTILIZATION:")
    print("-" * 60)
    for staff_id, util in output.staff_utilization.items():
        staff_name = next((s.name for s in input_data.staff if s.id == staff_id), "Unknown")
        print(f"  {staff_name}: {util:.1f}%")
