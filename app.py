from flask import Flask, render_template, request, jsonify, session
import json
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io
import base64

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'

class VisaRuleEngine:
    def __init__(self, rules_file):
        with open(rules_file, 'r', encoding='utf-8') as f:
            self.data = json.load(f)
        self.rules = self.data['rules']
        self.questions = self.data['questions']
        self.visa_types = self.data['visa_types']

    def evaluate_condition(self, condition, facts):
        """Evaluate a single condition against facts"""
        if isinstance(condition, str):
            return facts.get(condition, False)
        elif isinstance(condition, dict):
            if condition['type'] == 'AND':
                return all(self.evaluate_condition(c, facts) for c in condition['conditions'])
            elif condition['type'] == 'OR':
                return any(self.evaluate_condition(c, facts) for c in condition['conditions'])
        return False

    def get_applicable_visas(self, user_answers):
        """Determine which visas are applicable based on user answers"""
        facts = {}

        # Convert user answers to facts
        for question_id, answer in user_answers.items():
            question = next((q for q in self.questions if q['id'] == question_id), None)
            if question and answer:
                facts[question['condition_id']] = True

        # Forward chaining to derive new facts
        changed = True
        max_iterations = 50
        iteration = 0

        while changed and iteration < max_iterations:
            changed = False
            iteration += 1

            for rule in self.rules:
                conclusion = rule['conclusion']
                if conclusion not in facts:
                    if self.evaluate_condition(rule['conditions'], facts):
                        facts[conclusion] = True
                        changed = True

        # Find applicable visa types
        applicable_visas = []
        for visa_type, visa_info in self.visa_types.items():
            if facts.get(visa_type, False):
                # Get satisfied conditions
                satisfied_conditions = []
                missing_conditions = []

                # Find the rule that concludes this visa type
                visa_rule = next((rule for rule in self.rules if rule['conclusion'] == visa_type), None)
                if visa_rule:
                    required_conditions = self._get_all_conditions_for_visa(visa_type)
                    for condition in required_conditions:
                        question = next((q for q in self.questions if q['condition_id'] == condition), None)
                        if question:
                            if user_answers.get(question['id']):
                                satisfied_conditions.append({
                                    'condition': condition,
                                    'question': question['text'],
                                    'answer': 'Yes'
                                })
                            else:
                                missing_conditions.append({
                                    'condition': condition,
                                    'question': question['text'],
                                    'answer': 'No' if question['id'] in user_answers else 'Not answered'
                                })

                applicable_visas.append({
                    'type': visa_type,
                    'name': visa_info['name'],
                    'description': visa_info['description'],
                    'color': visa_info['color'],
                    'satisfied_conditions': satisfied_conditions,
                    'missing_conditions': missing_conditions,
                    'confidence': len(satisfied_conditions) / max(1, len(satisfied_conditions) + len(missing_conditions))
                })

        # Sort by confidence
        applicable_visas.sort(key=lambda x: x['confidence'], reverse=True)

        return applicable_visas, facts

    def _get_all_conditions_for_visa(self, visa_type):
        """Get all conditions required for a specific visa type (recursive)"""
        conditions = set()

        def collect_conditions(rule_conclusion):
            rule = next((r for r in self.rules if r['conclusion'] == rule_conclusion), None)
            if rule:
                if isinstance(rule['conditions'], dict):
                    for condition in rule['conditions']['conditions']:
                        if isinstance(condition, str):
                            # Check if this condition is itself a conclusion of another rule
                            sub_rule = next((r for r in self.rules if r['conclusion'] == condition), None)
                            if sub_rule:
                                collect_conditions(condition)
                            else:
                                conditions.add(condition)

        collect_conditions(visa_type)
        return list(conditions)

    def get_next_questions(self, answered_questions, visa_types_filter=None):
        """Get all unanswered questions in order, optionally filtered by visa types"""
        answered_set = set(answered_questions)
        unanswered = [q for q in self.questions if q['id'] not in answered_set]

        # Filter by visa types if specified
        if visa_types_filter and len(visa_types_filter) > 0:
            filtered = []
            for q in unanswered:
                # Always include screening questions
                if q.get('is_screening', False):
                    filtered.append(q)
                    continue
                # Include questions without visa_types (universal questions)
                if not q.get('visa_types'):
                    filtered.append(q)
                    continue
                # Include questions matching selected visa types
                if any(vt in q.get('visa_types', []) for vt in visa_types_filter):
                    filtered.append(q)
            unanswered = filtered

        # Return all unanswered questions
        return unanswered

# Initialize the rule engines
# Use sequential E-visa questions
try:
    with open('e_visa_sequential.json', 'r', encoding='utf-8') as f:
        e_visa_data = json.load(f)
    # Create a simple engine with sequential questions
    class SimpleEngine:
        def __init__(self, data):
            self.questions = data['questions']
            self.total_questions = data['total_questions']

        def get_next_questions(self, answered_questions, visa_types_filter=None):
            answered_set = set(answered_questions)
            unanswered = [q for q in self.questions if q['id'] not in answered_set]
            return unanswered

        def get_applicable_visas(self, user_answers):
            # Count yes answers
            yes_count = sum(1 for a in user_answers.values() if a is True)
            total = len(user_answers)
            confidence = yes_count / total if total > 0 else 0

            if confidence >= 0.7:
                return [{
                    'type': 'E_visa',
                    'name': 'Eビザ（条約貿易商・投資家）',
                    'description': 'あなたの状況はEビザの要件を満たしています。',
                    'color': '#4CAF50',
                    'satisfied_conditions': [],
                    'missing_conditions': [],
                    'confidence': confidence
                }], {}
            else:
                return [], {}

    rule_engine = SimpleEngine(e_visa_data)
except Exception as e:
    print(f"Error loading e_visa_sequential.json: {e}")
    # Fallback to original
    rule_engine = VisaRuleEngine('rules.json')

@app.route('/')
def index():
    session.clear()  # Clear session on new visit
    return render_template('index.html')

@app.route('/api/questions')
def get_questions():
    """Get all questions or next questions based on current progress"""
    try:
        answered = request.args.get('answered', '')
        answered_list = [a for a in answered.split(',') if a] if answered else []
        visa_types = request.args.get('visa_types', '')
        visa_types_list = [v for v in visa_types.split(',') if v] if visa_types else []

        print(f"[API] Getting questions - answered: {len(answered_list)}, visa_types: {visa_types_list}")

        next_questions = rule_engine.get_next_questions(answered_list, visa_types_list)
        print(f"[API] Returning {len(next_questions)} questions")

        # Calculate total questions based on visa type filter
        if visa_types_list:
            total_questions = len([q for q in rule_engine.questions
                                  if q.get('is_screening', False) or
                                     not q.get('visa_types') or
                                     any(vt in q.get('visa_types', []) for vt in visa_types_list)])
        else:
            total_questions = len(rule_engine.questions)

        return jsonify({
            'questions': next_questions[:1],  # Return 1 question at a time
            'total_questions': total_questions,
            'answered_count': len(answered_list)
        })
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"[ERROR] in get_questions: {error_msg}")
        print(f"[ERROR] Traceback:\n{error_trace}")
        return jsonify({
            'error': error_msg,
            'traceback': error_trace,
            'questions': [],
            'total_questions': 0,
            'answered_count': 0
        }), 500

@app.route('/api/evaluate', methods=['POST'])
def evaluate_visa():
    """Evaluate user answers and return applicable visas"""
    user_answers = request.json.get('answers', {})

    # Store answers in session
    session['user_answers'] = user_answers

    applicable_visas, facts = rule_engine.get_applicable_visas(user_answers)

    return jsonify({
        'applicable_visas': applicable_visas,
        'total_questions': len(rule_engine.questions),
        'answered_questions': len(user_answers),
        'evaluation_date': datetime.now().isoformat()
    })

@app.route('/api/export/pdf', methods=['POST'])
def export_pdf():
    """Export visa evaluation results as PDF"""
    try:
        data = request.json
        applicable_visas = data.get('applicable_visas', [])
        user_info = data.get('user_info', {})

        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)

        # Define styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=30,
            alignment=1  # Center alignment
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor='#2c3e50'
        )

        # Build PDF content
        story = []

        # Title
        story.append(Paragraph("米国ビザ評価結果", title_style))
        story.append(Spacer(1, 12))

        # Date
        story.append(Paragraph(f"評価日: {datetime.now().strftime('%Y年%m月%d日')}", styles['Normal']))
        story.append(Spacer(1, 20))

        # User information (if provided)
        if user_info:
            story.append(Paragraph("申請者情報:", heading_style))
            for key, value in user_info.items():
                story.append(Paragraph(f"{key}: {value}", styles['Normal']))
            story.append(Spacer(1, 20))

        # Visa recommendations
        story.append(Paragraph("推奨ビザタイプ:", heading_style))

        if applicable_visas:
            for i, visa in enumerate(applicable_visas, 1):
                confidence_percent = int(visa['confidence'] * 100)
                story.append(Paragraph(f"{i}. {visa['name']} (適合度: {confidence_percent}%)", styles['Heading3']))
                story.append(Paragraph(visa['description'], styles['Normal']))

                if visa['satisfied_conditions']:
                    story.append(Paragraph("満たされた要件:", styles['Heading4']))
                    for condition in visa['satisfied_conditions']:
                        story.append(Paragraph(f"• {condition['question']}", styles['Normal']))

                if visa['missing_conditions']:
                    story.append(Paragraph("不足している要件:", styles['Heading4']))
                    for condition in visa['missing_conditions']:
                        story.append(Paragraph(f"• {condition['question']}", styles['Normal']))

                story.append(Spacer(1, 20))
        else:
            story.append(Paragraph("提供された情報に基づいて適切なビザタイプが見つかりませんでした。", styles['Normal']))

        # Disclaimer
        story.append(Spacer(1, 30))
        story.append(Paragraph("免責事項:", heading_style))
        story.append(Paragraph(
            "この評価は情報提供のみを目的としており、法的助言を構成するものではありません。"
            "正式なガイダンスについては、移民弁護士または公式機関にご相談ください。",
            styles['Normal']
        ))

        # Build PDF
        doc.build(story)

        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()

        # Return base64 encoded PDF
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

        return jsonify({
            'success': True,
            'pdf_data': pdf_base64,
            'filename': f'visa_evaluation_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/session/clear', methods=['POST'])
def clear_session():
    """Clear the current session"""
    session.clear()
    return jsonify({'success': True})

@app.route('/api/evisa/question')
def get_evisa_question():
    """Get current E-visa question based on answers"""
    try:
        # Get current node from session or start at root
        current_node = session.get('evisa_current_node', e_visa_engine.decision_tree['root'])
        answers = session.get('evisa_answers', {})

        print(f"[E-VISA] Getting question for node: {current_node}")

        # Get the question or result
        question_data = e_visa_engine.get_current_question(current_node, answers)

        return jsonify({
            'success': True,
            'current_node': current_node,
            'data': question_data,
            'progress': {
                'answered': len(answers),
                'path': session.get('evisa_path', [current_node])
            }
        })

    except Exception as e:
        import traceback
        print(f"[ERROR] in get_evisa_question: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/evisa/answer', methods=['POST'])
def submit_evisa_answer():
    """Submit answer and get next question"""
    try:
        data = request.json
        node_id = data.get('node_id')
        answer = data.get('answer')

        print(f"[E-VISA] Answer submitted - node: {node_id}, answer: {answer}")

        # Get current answers from session
        answers = session.get('evisa_answers', {})
        path = session.get('evisa_path', [e_visa_engine.decision_tree['root']])

        # Store the answer
        answers[node_id] = answer
        session['evisa_answers'] = answers

        # Get next node
        next_node = e_visa_engine.get_next_node(node_id, answer)

        if next_node:
            path.append(next_node)
            session['evisa_path'] = path
            session['evisa_current_node'] = next_node

            # Get the next question or result
            next_data = e_visa_engine.get_current_question(next_node, answers)

            return jsonify({
                'success': True,
                'next_node': next_node,
                'data': next_data,
                'progress': {
                    'answered': len(answers),
                    'path': path
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No next node found'
            }), 400

    except Exception as e:
        import traceback
        print(f"[ERROR] in submit_evisa_answer: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/evisa/reset', methods=['POST'])
def reset_evisa():
    """Reset E-visa assessment"""
    session.pop('evisa_current_node', None)
    session.pop('evisa_answers', None)
    session.pop('evisa_path', None)
    return jsonify({'success': True})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)