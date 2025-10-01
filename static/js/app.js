// Application State
let currentState = {
    currentQuestionIndex: 0,
    questions: [],
    answers: {},
    totalQuestions: 0,
    isLoading: false
};

// DOM Elements
const welcomeSection = document.getElementById('welcomeSection');
const questionnaireSection = document.getElementById('questionnaireSection');
const resultsSection = document.getElementById('resultsSection');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const loadingOverlay = document.getElementById('loadingOverlay');

// Question Elements
const questionText = document.getElementById('questionText');
const questionNote = document.getElementById('questionNote');
const answerOptions = document.getElementById('answerOptions');
const currentQuestionNum = document.getElementById('currentQuestionNum');
const totalQuestions = document.getElementById('totalQuestions');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');

// Results Elements
const resultsContent = document.getElementById('resultsContent');

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('US Visa Expert System initialized');
});

// Start the questionnaire
async function startQuestionnaire() {
    showLoading('Loading questions...');

    try {
        // Clear any previous session
        await fetch('/api/session/clear', { method: 'POST' });

        // Reset state
        currentState = {
            currentQuestionIndex: 0,
            questions: [],
            answers: {},
            totalQuestions: 0,
            isLoading: false
        };

        // Load initial questions
        await loadQuestions();

        // Switch to questionnaire view
        hideAllSections();
        questionnaireSection.style.display = 'block';
        progressContainer.style.display = 'block';

        // Show first question
        showCurrentQuestion();
        updateProgress();

    } catch (error) {
        console.error('Error starting questionnaire:', error);
        alert('Failed to start questionnaire. Please try again.');
    } finally {
        hideLoading();
    }
}

// Load questions from server
async function loadQuestions() {
    try {
        const answeredQuestions = Object.keys(currentState.answers).join(',');
        const response = await fetch(`/api/questions?answered=${answeredQuestions}`);
        const data = await response.json();

        currentState.questions = data.questions;
        currentState.totalQuestions = data.total_questions;

        totalQuestions.textContent = currentState.totalQuestions;

    } catch (error) {
        console.error('Error loading questions:', error);
        throw error;
    }
}

// Show current question
function showCurrentQuestion() {
    if (currentState.currentQuestionIndex >= currentState.questions.length) {
        // No more questions, evaluate results
        evaluateResults();
        return;
    }

    const question = currentState.questions[currentState.currentQuestionIndex];

    // Update question text
    questionText.textContent = question.text;

    // Show note if available
    if (question.note) {
        questionNote.textContent = question.note;
        questionNote.style.display = 'block';
    } else {
        questionNote.style.display = 'none';
    }

    // Update question counter
    const answeredCount = Object.keys(currentState.answers).length;
    currentQuestionNum.textContent = answeredCount + 1;

    // Create answer options
    createAnswerOptions(question);

    // Update navigation buttons
    updateNavigationButtons();
}

// Create answer options for current question
function createAnswerOptions(question) {
    answerOptions.innerHTML = '';

    if (question.type === 'boolean') {
        // Yes/No options
        const yesOption = createAnswerOption('yes', 'Yes', question.id);
        const noOption = createAnswerOption('no', 'No', question.id);

        answerOptions.appendChild(yesOption);
        answerOptions.appendChild(noOption);
    } else if (question.type === 'multiple_choice' && question.options) {
        // Multiple choice options
        question.options.forEach((option, index) => {
            const optionElement = createAnswerOption(option.value, option.text, question.id);
            answerOptions.appendChild(optionElement);
        });
    } else if (question.type === 'number') {
        // Number input
        const inputContainer = document.createElement('div');
        inputContainer.className = 'number-input-container';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'number-input';
        input.placeholder = 'Enter a number';
        input.id = `input-${question.id}`;

        if (question.min !== undefined) input.min = question.min;
        if (question.max !== undefined) input.max = question.max;

        // Pre-fill if already answered
        if (currentState.answers[question.id] !== undefined) {
            input.value = currentState.answers[question.id];
        }

        input.addEventListener('input', function() {
            const value = parseInt(this.value);
            if (!isNaN(value)) {
                currentState.answers[question.id] = value;
                updateNavigationButtons();
            }
        });

        inputContainer.appendChild(input);
        answerOptions.appendChild(inputContainer);
    }

    // Pre-select if already answered
    if (currentState.answers[question.id] !== undefined) {
        const existingAnswer = currentState.answers[question.id];
        const selectedOption = answerOptions.querySelector(`[data-value="${existingAnswer}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }
}

// Create individual answer option
function createAnswerOption(value, text, questionId) {
    const option = document.createElement('button');
    option.className = 'answer-option';
    option.textContent = text;
    option.setAttribute('data-value', value);

    option.addEventListener('click', function() {
        // Remove selection from other options
        answerOptions.querySelectorAll('.answer-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Select this option
        this.classList.add('selected');

        // Store answer
        const answerValue = value === 'yes' ? true : value === 'no' ? false : value;
        currentState.answers[questionId] = answerValue;

        // Update navigation
        updateNavigationButtons();
    });

    return option;
}

// Update navigation buttons
function updateNavigationButtons() {
    const currentQuestion = currentState.questions[currentState.currentQuestionIndex];
    const hasAnswer = currentState.answers[currentQuestion?.id] !== undefined;

    // Enable/disable next button
    nextBtn.disabled = !hasAnswer;

    // Show/hide back button
    const answeredCount = Object.keys(currentState.answers).length;
    backBtn.style.display = answeredCount > 0 ? 'block' : 'none';
}

// Go to next question
async function nextQuestion() {
    if (currentState.isLoading) return;

    const currentQuestion = currentState.questions[currentState.currentQuestionIndex];
    if (currentState.answers[currentQuestion.id] === undefined) {
        return; // No answer selected
    }

    currentState.currentQuestionIndex++;
    updateProgress();

    // Check if we've reached the end of current questions or answered enough
    const totalAnswered = Object.keys(currentState.answers).length;

    if (currentState.currentQuestionIndex >= currentState.questions.length) {
        // Check if we have enough answers to make recommendations
        if (totalAnswered >= 5) {
            // We have enough answers, proceed to evaluation
            evaluateResults();
            return;
        }

        // Load more questions based on current answers
        showLoading('Loading next questions...');
        try {
            await loadQuestions();
            currentState.currentQuestionIndex = 0; // Reset to show new questions

            // If no new questions available, proceed to evaluation
            if (currentState.questions.length === 0) {
                evaluateResults();
                return;
            }
        } catch (error) {
            console.error('Error loading more questions:', error);
            // If error loading questions, proceed to evaluation
            evaluateResults();
            return;
        } finally {
            hideLoading();
        }
    }

    showCurrentQuestion();
}

// Go back to previous question
function goBack() {
    if (currentState.isLoading) return;

    // Remove the last answered question
    const questionIds = Object.keys(currentState.answers);
    if (questionIds.length > 0) {
        const lastQuestionId = questionIds[questionIds.length - 1];
        delete currentState.answers[lastQuestionId];

        // Adjust current question index
        if (currentState.currentQuestionIndex > 0) {
            currentState.currentQuestionIndex--;
        }

        updateProgress();
        showCurrentQuestion();
    }
}

// Update progress bar
function updateProgress() {
    const answeredCount = Object.keys(currentState.answers).length;

    // Use dynamic total based on answered questions
    let estimatedTotal = Math.max(currentState.totalQuestions, answeredCount + currentState.questions.length);

    // Cap the progress to make it feel more responsive
    let progress;
    if (answeredCount <= 8) {
        progress = (answeredCount / 12) * 80; // First 8 questions = 80% of progress
    } else {
        progress = 80 + ((answeredCount - 8) / 4) * 20; // Remaining questions = 20%
    }

    progress = Math.min(progress, 95); // Never show 100% until evaluation

    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${answeredCount} questions answered`;
}

// Evaluate results
async function evaluateResults() {
    // Complete the progress bar
    progressFill.style.width = '100%';
    progressText.textContent = 'Analysis complete';

    showLoading('Analyzing your answers...');

    try {
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answers: currentState.answers
            })
        });

        const data = await response.json();

        // Show results
        displayResults(data);

        // Switch to results view
        hideAllSections();
        resultsSection.style.display = 'block';
        progressContainer.style.display = 'none';

    } catch (error) {
        console.error('Error evaluating results:', error);
        alert('Failed to evaluate results. Please try again.');
    } finally {
        hideLoading();
    }
}

// Display results
function displayResults(data) {
    resultsContent.innerHTML = '';

    if (data.applicable_visas && data.applicable_visas.length > 0) {
        data.applicable_visas.forEach((visa, index) => {
            const visaCard = createVisaCard(visa, index === 0);
            resultsContent.appendChild(visaCard);
        });
    } else {
        // No applicable visas found
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <h3>No Suitable Visa Types Found</h3>
            <p>Based on your answers, we couldn't identify a specific visa type that matches your situation. This doesn't mean you're not eligible for a US visa.</p>
            <p>We recommend consulting with an immigration attorney who can provide personalized guidance for your specific circumstances.</p>
            <button class="btn btn-primary" onclick="restartAssessment()">
                <i class="fas fa-redo"></i>
                Try Again
            </button>
        `;
        resultsContent.appendChild(noResults);
    }

    // Store results for PDF export
    window.evaluationResults = data;
}

// Create visa card element
function createVisaCard(visa, isPrimary = false) {
    const card = document.createElement('div');
    card.className = `visa-card ${isPrimary ? 'primary' : ''}`;
    card.style.borderLeftColor = visa.color;

    const confidencePercent = Math.round(visa.confidence * 100);
    let confidenceClass = 'high';
    if (confidencePercent < 70) confidenceClass = 'medium';
    if (confidencePercent < 50) confidenceClass = 'low';

    card.innerHTML = `
        <div class="visa-header">
            <div class="visa-title">
                <h3>${visa.name}</h3>
                <p>${visa.description}</p>
            </div>
            <div class="confidence-badge ${confidenceClass}">
                ${confidencePercent}% Match
            </div>
        </div>

        <div class="visa-details">
            ${visa.satisfied_conditions.length > 0 ? `
                <div class="conditions-section">
                    <h4><i class="fas fa-check-circle" style="color: #27ae60;"></i> Requirements You Meet</h4>
                    <ul class="condition-list">
                        ${visa.satisfied_conditions.map(condition => `
                            <li class="condition-item satisfied">
                                <i class="fas fa-check"></i>
                                <span>${condition.question}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}

            ${visa.missing_conditions.length > 0 ? `
                <div class="conditions-section">
                    <h4><i class="fas fa-exclamation-circle" style="color: #e74c3c;"></i> Additional Requirements</h4>
                    <ul class="condition-list">
                        ${visa.missing_conditions.map(condition => `
                            <li class="condition-item missing">
                                <i class="fas fa-times"></i>
                                <span>${condition.question}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

// Export results to PDF
async function exportToPDF() {
    if (!window.evaluationResults) {
        alert('No results to export');
        return;
    }

    showLoading('Generating PDF...');

    try {
        const response = await fetch('/api/export/pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                applicable_visas: window.evaluationResults.applicable_visas,
                user_info: {
                    'Assessment Date': new Date().toLocaleDateString(),
                    'Total Questions Answered': Object.keys(currentState.answers).length
                }
            })
        });

        const data = await response.json();

        if (data.success) {
            // Create download link
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${data.pdf_data}`;
            link.download = data.filename;
            link.click();
        } else {
            throw new Error(data.error || 'Failed to generate PDF');
        }

    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        hideLoading();
    }
}

// Restart assessment
async function restartAssessment() {
    showLoading('Restarting assessment...');

    try {
        // Clear session
        await fetch('/api/session/clear', { method: 'POST' });

        // Reset state
        currentState = {
            currentQuestionIndex: 0,
            questions: [],
            answers: {},
            totalQuestions: 0,
            isLoading: false
        };

        // Clear results
        window.evaluationResults = null;

        // Switch to welcome screen
        hideAllSections();
        welcomeSection.style.display = 'block';
        progressContainer.style.display = 'none';

    } catch (error) {
        console.error('Error restarting assessment:', error);
    } finally {
        hideLoading();
    }
}

// Utility Functions
function hideAllSections() {
    welcomeSection.style.display = 'none';
    questionnaireSection.style.display = 'none';
    resultsSection.style.display = 'none';
}

function showLoading(message = 'Loading...') {
    currentState.isLoading = true;
    loadingOverlay.style.display = 'flex';
    loadingOverlay.querySelector('p').textContent = message;
}

function hideLoading() {
    currentState.isLoading = false;
    loadingOverlay.style.display = 'none';
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('Application error:', event.error);
    hideLoading();
});

// Handle fetch errors
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    hideLoading();
});