# US Visa Expert System

A comprehensive web application that helps users determine the most suitable US visa type based on their specific situation and requirements.

## Features

- **Rule-Based Expert System**: Advanced inference engine based on official visa requirements
- **Interactive Questionnaire**: Step-by-step guidance with smart question sequencing
- **Intelligent Analysis**: Forward and backward chaining inference for accurate recommendations
- **Detailed Results**: Comprehensive breakdown of requirements met and missing
- **PDF Export**: Download detailed evaluation reports
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Supported Visa Types

- **E Visa** (Treaty Trader/Investor)
- **L Visa** (Intracompany Transfer) - Both Blanket and Individual
- **H-1B Visa** (Specialty Occupation)
- **B Visa** (Business/Tourism) - Multiple variants
- **J-1 Visa** (Exchange Visitor)
- **Various specialized visa types**

## Installation

1. **Clone or download the project files**
2. **Navigate to the project directory**
   ```bash
   cd visa_app
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. **Start the Flask server**
   ```bash
   python app.py
   ```

2. **Open your web browser and navigate to**
   ```
   http://localhost:5000
   ```

## Project Structure

```
visa_app/
├── app.py                 # Main Flask application
├── rules.json            # Rule-based knowledge base
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── static/
│   ├── css/
│   │   └── style.css     # Application styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── templates/
    └── index.html        # Main HTML template
```

## How It Works

### Rule Engine
The system uses a sophisticated rule-based inference engine that:
- Processes user answers through forward chaining
- Derives conclusions based on logical rules
- Ranks visa types by confidence/match percentage
- Identifies satisfied and missing requirements

### Knowledge Base
The rules.json file contains:
- **30 interconnected rules** from the original visa knowledge document
- **42+ questions** covering all visa scenarios
- **10 visa types** with detailed descriptions
- **Logical conditions** using AND/OR operators

### Question Logic
- Smart question sequencing based on previous answers
- Backward reasoning to ask only relevant questions
- Progress tracking and ability to go back
- Context-aware question presentation

## API Endpoints

- `GET /` - Main application interface
- `GET /api/questions` - Retrieve next relevant questions
- `POST /api/evaluate` - Evaluate user answers and return recommendations
- `POST /api/export/pdf` - Generate PDF report
- `POST /api/session/clear` - Clear user session

## Technical Implementation

### Backend (Python/Flask)
- **VisaRuleEngine**: Core inference engine with forward chaining
- **Condition Evaluation**: Recursive AND/OR logic processing
- **Session Management**: User state tracking
- **PDF Generation**: ReportLab-based document creation

### Frontend (HTML/CSS/JavaScript)
- **Single Page Application**: Smooth transitions between sections
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Responsive Design**: Mobile-first approach
- **State Management**: Client-side answer tracking and progress

### Rule Processing
1. User answers are converted to facts
2. Forward chaining applies rules iteratively
3. New facts are derived until no more rules fire
4. Visa eligibility is determined from final facts
5. Results are ranked by confidence and completeness

## Customization

### Adding New Rules
Edit `rules.json` to add new visa types or modify existing rules:

```json
{
  "id": 31,
  "description": "New Rule Description",
  "conditions": {
    "type": "AND",
    "conditions": ["condition1", "condition2"]
  },
  "conclusion": "new_visa_type"
}
```

### Adding New Questions
Add questions to the questions array in `rules.json`:

```json
{
  "id": "new_question_id",
  "text": "Your question text?",
  "type": "boolean",
  "condition_id": "corresponding_condition"
}
```

### Adding New Visa Types
Define new visa types in the visa_types section:

```json
"new_visa": {
  "name": "New Visa Type",
  "description": "Description of the visa",
  "color": "#hexcolor"
}
```

## Notes on Implementation

- **Question 6 Placeholder**: The original document referenced "Question 6" without clear definition. This has been implemented as a placeholder that can be clarified and updated.
- **Rule Complexity**: Some rules have been interpreted based on context where the original document was unclear.
- **Scalability**: The system is designed to handle additional rules and visa types without major restructuring.

## Security Considerations

- Change the Flask secret key in production
- Implement proper session management for production use
- Add input validation and sanitization
- Consider implementing rate limiting for API endpoints

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Internet Explorer 11+ (with reduced functionality)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

This project is for educational and informational purposes only. It does not constitute legal advice and should not be used as a substitute for professional immigration consultation.

## Disclaimer

This system provides general guidance only and does not constitute legal advice. Immigration laws and requirements can change frequently. Always consult with qualified immigration attorneys and official government sources for the most current and accurate information regarding US visa applications.