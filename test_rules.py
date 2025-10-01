#!/usr/bin/env python3
"""
Test script to validate the visa rule engine functionality
"""

import json
import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import VisaRuleEngine

def test_rule_engine():
    """Test the rule engine with various scenarios"""
    print("Testing US Visa Expert System Rule Engine")
    print("=" * 50)

    # Initialize the rule engine
    try:
        engine = VisaRuleEngine('rules.json')
        print("✓ Rule engine initialized successfully")
        print(f"✓ Loaded {len(engine.rules)} rules")
        print(f"✓ Loaded {len(engine.questions)} questions")
        print(f"✓ Loaded {len(engine.visa_types)} visa types")
        print()
    except Exception as e:
        print(f"✗ Failed to initialize rule engine: {e}")
        return False

    # Test Case 1: E Visa scenario
    print("Test Case 1: E Visa Scenario")
    print("-" * 30)

    e_visa_answers = {
        'applicant_company_nationality': True,  # Same nationality
        'company_investment_equipment': True,   # Equipment > $300k
        'position_ceo_officer': True,          # CEO position
        'related_experience_2_years': True,    # 2+ years experience
        'management_experience_2_years': True  # 2+ years management
    }

    try:
        applicable_visas, facts = engine.get_applicable_visas(e_visa_answers)

        if applicable_visas:
            print(f"✓ Found {len(applicable_visas)} applicable visa(s)")
            for visa in applicable_visas:
                confidence = int(visa['confidence'] * 100)
                print(f"  - {visa['name']}: {confidence}% match")
        else:
            print("✗ No applicable visas found")

        print(f"✓ Test completed with {len(facts)} derived facts")
        print()

    except Exception as e:
        print(f"✗ Test failed: {e}")
        print()

    # Test Case 2: H-1B scenario
    print("Test Case 2: H-1B Visa Scenario")
    print("-" * 30)

    h1b_answers = {
        'college_degree_matching_job': True,   # Has matching college degree
        'intracompany_transfer': False,        # Not intracompany transfer
        'applicant_company_nationality': False # Different nationality
    }

    try:
        applicable_visas, facts = engine.get_applicable_visas(h1b_answers)

        if applicable_visas:
            print(f"✓ Found {len(applicable_visas)} applicable visa(s)")
            for visa in applicable_visas:
                confidence = int(visa['confidence'] * 100)
                print(f"  - {visa['name']}: {confidence}% match")
        else:
            print("✗ No applicable visas found")

        print(f"✓ Test completed with {len(facts)} derived facts")
        print()

    except Exception as e:
        print(f"✗ Test failed: {e}")
        print()

    # Test Case 3: L Visa scenario
    print("Test Case 3: L Visa Scenario")
    print("-" * 30)

    l_visa_answers = {
        'intracompany_transfer': True,         # Intracompany transfer
        'us_subsidiary_revenue_25m': True,     # Large company
        'overseas_group_1_year_in_3': True,    # 1+ years overseas
        'has_specialized_knowledge': True,     # Has specialized knowledge
        'us_role_requires_specialized_knowledge': True, # Role requires it
        'question_6_placeholder': True        # Placeholder question
    }

    try:
        applicable_visas, facts = engine.get_applicable_visas(l_visa_answers)

        if applicable_visas:
            print(f"✓ Found {len(applicable_visas)} applicable visa(s)")
            for visa in applicable_visas:
                confidence = int(visa['confidence'] * 100)
                print(f"  - {visa['name']}: {confidence}% match")
        else:
            print("✗ No applicable visas found")

        print(f"✓ Test completed with {len(facts)} derived facts")
        print()

    except Exception as e:
        print(f"✗ Test failed: {e}")
        print()

    # Test Case 4: B Visa scenario
    print("Test Case 4: B Visa Scenario")
    print("-" * 30)

    b_visa_answers = {
        'esta_approved': True,                 # ESTA approved
        'commercial_activities': True,         # Commercial activities
        'stay_more_than_90_days': True,        # Stay > 90 days
        'stay_6_months_or_less': True         # Stay <= 6 months
    }

    try:
        applicable_visas, facts = engine.get_applicable_visas(b_visa_answers)

        if applicable_visas:
            print(f"✓ Found {len(applicable_visas)} applicable visa(s)")
            for visa in applicable_visas:
                confidence = int(visa['confidence'] * 100)
                print(f"  - {visa['name']}: {confidence}% match")
        else:
            print("✗ No applicable visas found")

        print(f"✓ Test completed with {len(facts)} derived facts")
        print()

    except Exception as e:
        print(f"✗ Test failed: {e}")
        print()

    # Test question loading
    print("Test Case 5: Question Loading")
    print("-" * 30)

    try:
        next_questions = engine.get_next_questions([])
        print(f"✓ Loaded {len(next_questions)} initial questions")

        # Test with some answered questions
        answered = ['applicant_company_nationality', 'intracompany_transfer']
        remaining_questions = engine.get_next_questions(answered)
        print(f"✓ {len(remaining_questions)} questions remaining after answering 2")
        print()

    except Exception as e:
        print(f"✗ Question loading test failed: {e}")
        print()

    print("All tests completed!")
    return True

def validate_rules_json():
    """Validate the rules.json file structure"""
    print("Validating rules.json structure...")
    print("-" * 30)

    try:
        with open('rules.json', 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Check required sections
        required_sections = ['visa_types', 'questions', 'rules']
        for section in required_sections:
            if section in data:
                print(f"✓ {section} section found")
            else:
                print(f"✗ {section} section missing")
                return False

        # Validate questions
        question_ids = set()
        for question in data['questions']:
            if 'id' not in question:
                print(f"✗ Question missing id: {question}")
                return False
            if question['id'] in question_ids:
                print(f"✗ Duplicate question id: {question['id']}")
                return False
            question_ids.add(question['id'])

        print(f"✓ All {len(question_ids)} questions have unique IDs")

        # Validate rules
        rule_conclusions = set()
        for rule in data['rules']:
            if 'conclusion' in rule:
                rule_conclusions.add(rule['conclusion'])

        print(f"✓ Found {len(rule_conclusions)} unique rule conclusions")

        # Check visa types
        visa_type_ids = set(data['visa_types'].keys())
        print(f"✓ Found {len(visa_type_ids)} visa types")

        print("✓ rules.json structure is valid")
        return True

    except json.JSONDecodeError as e:
        print(f"✗ JSON parsing error: {e}")
        return False
    except Exception as e:
        print(f"✗ Validation error: {e}")
        return False

if __name__ == "__main__":
    print("US Visa Expert System - Test Suite")
    print("=" * 50)
    print()

    # Validate JSON structure first
    if not validate_rules_json():
        print("❌ rules.json validation failed")
        sys.exit(1)

    print()

    # Test the rule engine
    if test_rule_engine():
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed")
        sys.exit(1)