"""
Multi-Visa Decision Tree Engine
Handles E-visa, L-visa, and B-visa decision trees
"""

import json

class MultiVisaEngine:
    def __init__(self):
        """Initialize engines for all visa types"""
        self.engines = {}

        # Load E-visa rules
        try:
            from e_visa_engine import EVisaDecisionEngine
            self.engines['E'] = EVisaDecisionEngine('e_visa_rules.json')
            print("E-visa engine loaded")
        except Exception as e:
            print(f"Error loading E-visa engine: {e}")

        # Load L-visa rules
        try:
            from e_visa_engine import EVisaDecisionEngine
            self.engines['L'] = EVisaDecisionEngine('l_visa_rules.json')
            print("L-visa engine loaded")
        except Exception as e:
            print(f"Error loading L-visa engine: {e}")

        # Load B-visa rules
        try:
            from e_visa_engine import EVisaDecisionEngine
            self.engines['B'] = EVisaDecisionEngine('b_visa_rules.json')
            print("B-visa engine loaded")
        except Exception as e:
            print(f"Error loading B-visa engine: {e}")

    def get_engine(self, visa_type):
        """Get the engine for a specific visa type"""
        if visa_type not in self.engines:
            raise ValueError(f"Unknown visa type: {visa_type}")
        return self.engines[visa_type]

    def get_current_question(self, visa_type, current_node_id, answers):
        """Get current question for a specific visa type"""
        engine = self.get_engine(visa_type)
        return engine.get_current_question(current_node_id, answers)

    def get_next_node(self, visa_type, current_node_id, answer):
        """Get next node for a specific visa type"""
        engine = self.get_engine(visa_type)
        return engine.get_next_node(current_node_id, answer)
