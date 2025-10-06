import json

class EVisaDecisionEngine:
    def __init__(self, rules_file='e_visa_rules.json'):
        with open(rules_file, 'r', encoding='utf-8') as f:
            self.data = json.load(f)
        self.decision_tree = self.data['decision_tree']
        self.visa_type = self.data['visa_type']

    def get_current_question(self, current_node_id, answers=None):
        """Get the current question based on node ID and previous answers"""
        if answers is None:
            answers = {}

        node = self.decision_tree['nodes'].get(current_node_id)

        if not node:
            return None

        # If it's a result node, return the result
        if node.get('type') == 'result':
            return {
                'type': 'result',
                'node_id': current_node_id,
                'decision': node['decision'],
                'title': node['title'],
                'message': node['message'],
                'next_steps': node.get('next_steps', []),
                'alternatives': node.get('alternatives', [])
            }

        # Otherwise, return the question
        return {
            'type': 'question',
            'node_id': current_node_id,
            'question': node['question'],
            'question_type': node['type'],
            'options': node.get('options', None)
        }

    def get_next_node(self, current_node_id, answer):
        """Determine the next node based on the current node and answer"""
        node = self.decision_tree['nodes'].get(current_node_id)

        if not node:
            return None

        # Handle boolean questions
        if node['type'] == 'boolean':
            if answer is True or answer == 'yes':
                return node.get('yes')
            else:
                return node.get('no')

        # Handle multiple choice questions
        elif node['type'] == 'multiple_choice':
            for option in node.get('options', []):
                if option['value'] == answer:
                    return option.get('next')
            return None

        return None

    def evaluate_path(self, answers):
        """Traverse the decision tree with given answers and return the result"""
        current_node_id = self.decision_tree['root']
        path = [current_node_id]

        while current_node_id:
            node = self.decision_tree['nodes'].get(current_node_id)

            if not node:
                break

            # If we reached a result node, return it
            if node.get('type') == 'result':
                return {
                    'result': node,
                    'path': path,
                    'questions_asked': len(path) - 1
                }

            # Get the answer for this node
            answer = answers.get(current_node_id)

            # If no answer yet, this is where we are
            if answer is None:
                break

            # Move to next node
            current_node_id = self.get_next_node(current_node_id, answer)
            if current_node_id:
                path.append(current_node_id)

        # Return current state (not finished)
        return {
            'current_node': current_node_id,
            'path': path,
            'questions_asked': len([p for p in path if self.decision_tree['nodes'].get(p, {}).get('type') != 'result'])
        }
