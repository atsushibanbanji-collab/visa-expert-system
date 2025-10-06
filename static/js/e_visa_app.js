// Visa Application State
let currentState = {
    visaType: null,  // 'E', 'L', or 'B'
    currentNode: null,
    answers: {},
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
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');

// Results Elements
const resultsContent = document.getElementById('resultsContent');

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Multi-Visa Expert System initialized');
});

// Select visa type
function selectVisaType(visaType) {
    currentState.visaType = visaType;
    console.log(`Selected visa type: ${visaType}`);
    startQuestionnaire();
}

// Start the questionnaire
async function startQuestionnaire() {
    if (!currentState.visaType) {
        alert('ビザタイプを選択してください');
        return;
    }
    showLoading('診断を開始しています...');

    try {
        // Reset session with visa type
        await fetch(`/api/visa/reset?type=${currentState.visaType}`, { method: 'POST' });

        // Reset state (keep visa type)
        const visaType = currentState.visaType;
        currentState = {
            visaType: visaType,
            currentNode: null,
            answers: {},
            isLoading: false
        };

        // Load first question
        await loadQuestion();

        // Switch to questionnaire view
        hideAllSections();
        questionnaireSection.style.display = 'block';
        progressContainer.style.display = 'block';
        updateProgress();

    } catch (error) {
        console.error('Error starting questionnaire:', error);
        alert('診断の開始に失敗しました。もう一度お試しください。');
    } finally {
        hideLoading();
    }
}

// Load current question
async function loadQuestion() {
    try {
        const response = await fetch(`/api/visa/question?type=${currentState.visaType}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '質問の読み込みに失敗しました');
        }

        console.log('Loaded question data:', data);

        currentState.currentNode = data.current_node;

        // Check if it's a result
        if (data.data.type === 'result') {
            showResult(data.data);
        } else {
            showQuestion(data.data);
        }

        updateProgress();

    } catch (error) {
        console.error('Error loading question:', error);
        throw error;
    }
}

// Show question
function showQuestion(questionData) {
    // Update question text (preserve line breaks)
    questionText.innerHTML = questionData.question.replace(/\n/g, '<br>');

    // Hide note for now
    questionNote.style.display = 'none';

    // Update question counter
    const answeredCount = Object.keys(currentState.answers).length;
    currentQuestionNum.textContent = answeredCount + 1;

    // Create answer options
    answerOptions.innerHTML = '';

    if (questionData.question_type === 'boolean') {
        // Yes/No options
        const yesOption = createAnswerButton('yes', 'はい', true);
        const noOption = createAnswerButton('no', 'いいえ', false);

        answerOptions.appendChild(yesOption);
        answerOptions.appendChild(noOption);
    } else if (questionData.question_type === 'multiple_choice' && questionData.options) {
        // Multiple choice options
        questionData.options.forEach(option => {
            const optionButton = createAnswerButton(option.value, option.text, option.value);
            answerOptions.appendChild(optionButton);
        });
    }

    // Hide back button for now (we'll implement history later)
    backBtn.style.display = 'none';
}

// Create answer button
function createAnswerButton(value, text, answerValue) {
    const button = document.createElement('button');
    button.className = 'answer-option';
    button.textContent = text;
    button.setAttribute('data-value', value);

    button.addEventListener('click', async function() {
        if (currentState.isLoading) return;

        // Submit answer
        await submitAnswer(answerValue);
    });

    return button;
}

// Submit answer and load next question
async function submitAnswer(answer) {
    if (!currentState.currentNode) {
        console.error('No current node');
        return;
    }

    showLoading('次の質問を読み込んでいます...');
    currentState.isLoading = true;

    try {
        const response = await fetch(`/api/visa/answer?type=${currentState.visaType}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                node_id: currentState.currentNode,
                answer: answer
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '回答の送信に失敗しました');
        }

        console.log('Answer submitted, next data:', data);

        // Store answer
        currentState.answers[currentState.currentNode] = answer;
        currentState.currentNode = data.next_node;

        // Show next question or result
        if (data.data.type === 'result') {
            showResult(data.data);
        } else {
            showQuestion(data.data);
        }

        updateProgress();

    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('回答の送信に失敗しました。もう一度お試しください。');
    } finally {
        currentState.isLoading = false;
        hideLoading();
    }
}

// Show result
function showResult(resultData) {
    console.log('Showing result:', resultData);

    hideAllSections();
    resultsSection.style.display = 'block';
    progressContainer.style.display = 'none';

    resultsContent.innerHTML = '';

    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';

    const isApproved = resultData.decision === 'approved';
    const iconClass = isApproved ? 'fa-check-circle' : 'fa-times-circle';
    const iconColor = isApproved ? '#10b981' : '#ef4444';

    let html = `
        <div class="result-header">
            <i class="fas ${iconClass}" style="font-size: 4rem; color: ${iconColor}; margin-bottom: 20px;"></i>
            <h2 style="color: #1e3a8a; font-size: 1.8rem; margin-bottom: 15px;">${resultData.title}</h2>
            <p style="font-size: 1.1rem; color: #64748b; line-height: 1.8;">${resultData.message}</p>
        </div>
    `;

    if (isApproved && resultData.next_steps && resultData.next_steps.length > 0) {
        html += `
            <div class="result-section">
                <h3 style="color: #1e3a8a; margin: 30px 0 15px 0;"><i class="fas fa-list-check"></i> 次のステップ</h3>
                <ol style="padding-left: 25px; line-height: 2;">
                    ${resultData.next_steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
        `;
    }

    if (!isApproved && resultData.alternatives && resultData.alternatives.length > 0) {
        html += `
            <div class="result-section">
                <h3 style="color: #1e3a8a; margin: 30px 0 15px 0;"><i class="fas fa-lightbulb"></i> 代替案</h3>
                <ul style="padding-left: 25px; line-height: 2;">
                    ${resultData.alternatives.map(alt => `<li>${alt}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    html += `
        <div class="result-actions" style="margin-top: 40px; display: flex; gap: 15px; justify-content: center;">
            <button class="btn btn-secondary" onclick="restartAssessment()">
                <i class="fas fa-redo"></i>
                最初から
            </button>
        </div>
    `;

    resultCard.innerHTML = html;
    resultsContent.appendChild(resultCard);

    // Complete progress
    progressFill.style.width = '100%';
}

// Update progress bar
function updateProgress() {
    const answeredCount = Object.keys(currentState.answers).length;

    // Estimate progress (max ~8 questions)
    const progress = Math.min((answeredCount / 8) * 95, 95);

    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${answeredCount} 質問に回答済み`;
}

// Restart assessment
async function restartAssessment() {
    await startQuestionnaire();
}

// Utility Functions
function hideAllSections() {
    welcomeSection.style.display = 'none';
    questionnaireSection.style.display = 'none';
    resultsSection.style.display = 'none';
}

function showLoading(message = '読み込み中...') {
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

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    hideLoading();
});
