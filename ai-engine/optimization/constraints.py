"""
Staff Optimization Constraints Configuration
Rules for CP-SAT solver to optimize staff allocation
"""

from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class StaffingConstraints:
    """Configuration for staff optimization constraints"""
    
    # Minimum staff required based on queue load
    MIN_STAFF_FOR_LOAD = {
        'low': 2,      # Queue load < 10
        'medium': 4,   # Queue load 10-30
        'high': 6,     # Queue load 30-50
        'critical': 8  # Queue load > 50
    }
    
    # Queue load thresholds
    LOAD_THRESHOLDS = {
        'low': (0, 10),
        'medium': (10, 30),
        'high': (30, 50),
        'critical': (50, float('inf'))
    }
    
    # Counter type to required skills mapping
    COUNTER_SKILL_MAPPING = {
        # Queue-management project counter taxonomy
        'general': ['general'],
        'loan': ['loan', 'general'],
        'account': ['account', 'general'],
        'cashier': ['cashier', 'general'],
        'inquiry': ['inquiry', 'general'],
        'premium': ['premium', 'general'],

        # Healthcare sample taxonomy (kept for backwards compatibility)
        'registration': ['basic', 'registration'],
        'consultation': ['intermediate', 'medical'],
        'pharmacy': ['intermediate', 'pharmacy'],
        'laboratory': ['advanced', 'lab_tech'],
        'billing': ['basic', 'billing'],
        'emergency': ['advanced', 'emergency']
    }
    
    # Staff shift constraints
    MIN_SHIFT_HOURS = 4  # Minimum shift duration in hours
    MAX_SHIFT_HOURS = 8  # Maximum shift duration in hours
    MIN_REST_TIME = 30   # Minimum rest time between shifts in minutes
    
    # Time slot configuration (24-hour operation)
    TIME_SLOTS_PER_HOUR = 4  # 15-minute intervals
    TOTAL_TIME_SLOTS = 24 * TIME_SLOTS_PER_HOUR  # 96 slots per day
    SLOT_DURATION = 15  # minutes
    
    # Budget constraints
    HOURLY_RATES = {
        'basic': 15,         # USD per hour
        'intermediate': 25,  # USD per hour
        'advanced': 40       # USD per hour
    }
    
    DEFAULT_DAILY_BUDGET = 5000  # USD
    
    # Workload distribution
    MAX_PATIENTS_PER_STAFF = {
        'basic': 5,
        'intermediate': 8,
        'advanced': 12
    }
    
    # Counter capacity
    COUNTER_CAPACITY = {
        # Queue-management project counter taxonomy
        'general': 3,
        'loan': 3,
        'account': 3,
        'cashier': 3,
        'inquiry': 3,
        'premium': 3,

        # Healthcare sample taxonomy
        'registration': 3,   # Max staff per counter type
        'consultation': 4,
        'pharmacy': 2,
        'laboratory': 3,
        'billing': 2,
        'emergency': 2
    }


class ConstraintValidator:
    """Validates optimization constraints and rules"""
    
    def __init__(self, config: StaffingConstraints = None):
        self.config = config or StaffingConstraints()
    
    def get_min_staff_for_load(self, queue_load: int) -> int:
        """
        Determine minimum staff required based on queue load
        
        Args:
            queue_load: Current or predicted queue load
            
        Returns:
            Minimum number of staff required
        """
        for category, (min_load, max_load) in self.config.LOAD_THRESHOLDS.items():
            if min_load <= queue_load < max_load:
                return self.config.MIN_STAFF_FOR_LOAD[category]
        return self.config.MIN_STAFF_FOR_LOAD['critical']
    
    def validate_skill_for_counter(self, staff_skills: List[str], counter_type: str) -> bool:
        """
        Check if staff has required skills for counter type
        
        Args:
            staff_skills: List of skills the staff member has
            counter_type: Type of counter (registration, consultation, etc.)
            
        Returns:
            True if staff has required skills
        """
        required_skills = self.config.COUNTER_SKILL_MAPPING.get(counter_type)

        # Unknown counter types are treated as generic so optimization remains feasible.
        if not required_skills:
            return True

        return any(skill in staff_skills for skill in required_skills)
    
    def validate_shift_duration(self, start_slot: int, end_slot: int) -> bool:
        """
        Check if shift duration meets constraints
        
        Args:
            start_slot: Starting time slot
            end_slot: Ending time slot
            
        Returns:
            True if shift duration is valid
        """
        duration_hours = (end_slot - start_slot) / self.config.TIME_SLOTS_PER_HOUR
        return (self.config.MIN_SHIFT_HOURS <= duration_hours <= 
                self.config.MAX_SHIFT_HOURS)
    
    def validate_rest_time(self, prev_end_slot: int, next_start_slot: int) -> bool:
        """
        Check if rest time between shifts meets minimum requirement
        
        Args:
            prev_end_slot: End slot of previous shift
            next_start_slot: Start slot of next shift
            
        Returns:
            True if rest time is adequate
        """
        rest_minutes = (next_start_slot - prev_end_slot) * self.config.SLOT_DURATION
        return rest_minutes >= self.config.MIN_REST_TIME
    
    def calculate_staff_cost(self, skill_level: str, hours: float) -> float:
        """
        Calculate cost for staff based on skill level and hours
        
        Args:
            skill_level: Staff skill level (basic, intermediate, advanced)
            hours: Number of hours worked
            
        Returns:
            Total cost in USD
        """
        hourly_rate = self.config.HOURLY_RATES.get(skill_level, 
                                                    self.config.HOURLY_RATES['basic'])
        return hourly_rate * hours
    
    def validate_budget(self, total_cost: float, budget: float = None) -> bool:
        """
        Check if total cost is within budget
        
        Args:
            total_cost: Total calculated cost
            budget: Budget limit (uses default if None)
            
        Returns:
            True if within budget
        """
        budget = budget or self.config.DEFAULT_DAILY_BUDGET
        return total_cost <= budget
    
    def get_max_patients_for_staff(self, skill_level: str) -> int:
        """
        Get maximum patients a staff member can handle
        
        Args:
            skill_level: Staff skill level
            
        Returns:
            Maximum number of patients
        """
        return self.config.MAX_PATIENTS_PER_STAFF.get(skill_level, 5)
    
    def get_counter_capacity(self, counter_type: str) -> int:
        """
        Get maximum staff capacity for a counter type
        
        Args:
            counter_type: Type of counter
            
        Returns:
            Maximum number of staff for this counter
        """
        # Use a safer default capacity for unknown counter types.
        return self.config.COUNTER_CAPACITY.get(counter_type, 3)
    
    def time_slot_to_time(self, slot: int) -> str:
        """
        Convert time slot number to human-readable time
        
        Args:
            slot: Time slot number (0-95)
            
        Returns:
            Time string in HH:MM format
        """
        total_minutes = slot * self.config.SLOT_DURATION
        hours = total_minutes // 60
        minutes = total_minutes % 60
        return f"{hours:02d}:{minutes:02d}"
    
    def time_to_slot(self, time_str: str) -> int:
        """
        Convert time string to slot number
        
        Args:
            time_str: Time in HH:MM format
            
        Returns:
            Time slot number
        """
        hours, minutes = map(int, time_str.split(':'))
        total_minutes = hours * 60 + minutes
        return total_minutes // self.config.SLOT_DURATION


class OptimizationRules:
    """Business rules for staff optimization"""
    
    def __init__(self, validator: ConstraintValidator = None):
        self.validator = validator or ConstraintValidator()
    
    def generate_staffing_recommendations(self, 
                                         current_load: int,
                                         predicted_load: int,
                                         available_staff: int) -> Dict:
        """
        Generate staffing recommendations based on loads
        
        Args:
            current_load: Current queue load
            predicted_load: Predicted queue load
            available_staff: Number of available staff
            
        Returns:
            Dictionary with recommendations
        """
        current_min = self.validator.get_min_staff_for_load(current_load)
        predicted_min = self.validator.get_min_staff_for_load(predicted_load)
        
        recommendations = {
            'current_load': current_load,
            'predicted_load': predicted_load,
            'current_min_staff': current_min,
            'predicted_min_staff': predicted_min,
            'available_staff': available_staff,
            'status': 'adequate',
            'action': 'maintain',
            'deficit': 0,
            'priority': 'normal'
        }
        
        # Check if we need more staff
        required_staff = max(current_min, predicted_min)
        
        if available_staff < current_min:
            recommendations['status'] = 'critical'
            recommendations['action'] = 'immediate_allocation'
            recommendations['deficit'] = current_min - available_staff
            recommendations['priority'] = 'high'
        elif available_staff < predicted_min:
            recommendations['status'] = 'warning'
            recommendations['action'] = 'prepare_allocation'
            recommendations['deficit'] = predicted_min - available_staff
            recommendations['priority'] = 'medium'
        elif available_staff > required_staff * 1.5:
            recommendations['status'] = 'overstaffed'
            recommendations['action'] = 'reduce_allocation'
            recommendations['priority'] = 'low'
        
        return recommendations
    
    def prioritize_counter_assignments(self, queue_loads: Dict[str, int]) -> List[Tuple[str, int]]:
        """
        Prioritize counter types for staff assignment based on queue loads
        
        Args:
            queue_loads: Dictionary mapping counter type to queue load
            
        Returns:
            List of (counter_type, priority) tuples, sorted by priority
        """
        priorities = []
        
        for counter_type, load in queue_loads.items():
            # Higher load = higher priority
            # Emergency always gets highest priority
            if counter_type == 'emergency':
                priority = 1000 + load
            else:
                priority = load
            
            priorities.append((counter_type, priority))
        
        return sorted(priorities, key=lambda x: x[1], reverse=True)
    
    def suggest_shift_adjustments(self, 
                                 current_schedule: List[Dict],
                                 predicted_loads: List[Tuple[int, int]]) -> List[Dict]:
        """
        Suggest shift adjustments based on predicted loads
        
        Args:
            current_schedule: Current shift schedule
            predicted_loads: List of (time_slot, predicted_load) tuples
            
        Returns:
            List of adjustment suggestions
        """
        suggestions = []
        
        for time_slot, load in predicted_loads:
            min_staff = self.validator.get_min_staff_for_load(load)
            time_str = self.validator.time_slot_to_time(time_slot)
            
            # Check current coverage for this time slot
            current_coverage = sum(
                1 for shift in current_schedule
                if shift['start_slot'] <= time_slot < shift['end_slot']
            )
            
            if current_coverage < min_staff:
                suggestions.append({
                    'time': time_str,
                    'time_slot': time_slot,
                    'current_staff': current_coverage,
                    'required_staff': min_staff,
                    'deficit': min_staff - current_coverage,
                    'action': 'add_staff',
                    'urgency': 'high' if min_staff - current_coverage > 2 else 'medium'
                })
        
        return suggestions


# Create default instances for easy import
DEFAULT_CONSTRAINTS = StaffingConstraints()
DEFAULT_VALIDATOR = ConstraintValidator()
DEFAULT_RULES = OptimizationRules()
