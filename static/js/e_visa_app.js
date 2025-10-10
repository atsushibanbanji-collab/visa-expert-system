// Visa Application State
let currentState = {
    visaType: null,  // 'E', 'L', or 'B'
    currentNode: null,
    answers: {},
    isLoading: false,
    devMode: false,  // Developer mode flag
    path: []  // Track the path through the decision tree
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

    // Check if dev mode was previously enabled
    const savedDevMode = localStorage.getItem('devMode');
    if (savedDevMode === 'true') {
        currentState.devMode = true;
        updateDevModeUI();
    }
});

// Toggle developer mode
function toggleDevMode() {
    currentState.devMode = !currentState.devMode;
    localStorage.setItem('devMode', currentState.devMode);
    updateDevModeUI();

    // Update dev panel if in questionnaire
    if (questionnaireSection.style.display !== 'none') {
        updateDevPanel();
    }
}

// Update developer mode UI
function updateDevModeUI() {
    const toggleBtn = document.getElementById('devModeToggle');
    const devPanel = document.getElementById('devPanel');

    if (currentState.devMode) {
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '<i class="fas fa-code"></i> 開発者モード ON';
        if (devPanel) {
            devPanel.style.display = 'block';
        }
    } else {
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<i class="fas fa-code"></i> 開発者モード';
        if (devPanel) {
            devPanel.style.display = 'none';
        }
    }
}

// Update developer panel with current state
async function updateDevPanel() {
    if (!currentState.devMode) return;

    document.getElementById('devVisaType').textContent = currentState.visaType || '-';
    document.getElementById('devCurrentNode').textContent = currentState.currentNode || '-';
    document.getElementById('devAnswerCount').textContent = Object.keys(currentState.answers).length;
    document.getElementById('devPath').textContent = currentState.path.join(' → ') || '-';

    // Load knowledge data to get question texts
    if (currentState.visaType && !knowledgeData[currentState.visaType]) {
        await loadKnowledgeData(currentState.visaType);
    }

    // Format answers with question texts
    let formattedAnswers = {};
    if (currentState.visaType && knowledgeData[currentState.visaType]) {
        const nodes = knowledgeData[currentState.visaType].decision_tree.nodes;
        for (const [nodeId, answer] of Object.entries(currentState.answers)) {
            const node = nodes[nodeId];
            const questionText = node ? (node.question || nodeId).split('\n')[0].substring(0, 60) : nodeId;
            const answerText = answer === true ? 'はい' : answer === false ? 'いいえ' : answer;
            formattedAnswers[nodeId] = {
                question: questionText + (questionText.length >= 60 ? '...' : ''),
                answer: answerText
            };
        }
    } else {
        formattedAnswers = currentState.answers;
    }

    document.getElementById('devAnswers').textContent = JSON.stringify(formattedAnswers, null, 2);
}

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

        // Reset state (keep visa type and dev mode)
        const visaType = currentState.visaType;
        const devMode = currentState.devMode;
        currentState = {
            visaType: visaType,
            currentNode: null,
            answers: {},
            isLoading: false,
            devMode: devMode,
            path: []
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

        // Update path
        if (data.progress && data.progress.path) {
            currentState.path = data.progress.path;
        }

        // Check if it's a result
        if (data.data.type === 'result') {
            showResult(data.data);
        } else {
            showQuestion(data.data);
        }

        updateProgress();
        updateDevPanel();

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

        // Update path
        if (data.progress && data.progress.path) {
            currentState.path = data.progress.path;
        }

        // Show next question or result
        if (data.data.type === 'result') {
            showResult(data.data);
        } else {
            showQuestion(data.data);
        }

        updateProgress();
        updateDevPanel();

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
    // Reset session
    if (currentState.visaType) {
        await fetch(`/api/visa/reset?type=${currentState.visaType}`, { method: 'POST' });
    }

    // Reset state completely
    currentState = {
        visaType: null,
        currentNode: null,
        answers: {},
        isLoading: false,
        devMode: currentState.devMode,  // Preserve dev mode
        path: []
    };

    // Go back to welcome screen
    hideAllSections();
    welcomeSection.style.display = 'block';
    progressContainer.style.display = 'none';

    // Update dev panel
    updateDevPanel();
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

// Knowledge Database Modal Functions
let currentKBVisaType = 'E';
let knowledgeData = {};

async function openKnowledgeDB() {
    const modal = document.getElementById('knowledgeModal');
    modal.style.display = 'block';

    // Load current visa type or default to E
    currentKBVisaType = currentState.visaType || 'E';

    // Load knowledge data if not already loaded
    if (!knowledgeData[currentKBVisaType]) {
        await loadKnowledgeData(currentKBVisaType);
    }

    // Display the data
    displayKnowledgeData(currentKBVisaType);

    // Set active tab
    setActiveKBTab(currentKBVisaType);
}

function closeKnowledgeDB() {
    const modal = document.getElementById('knowledgeModal');
    modal.style.display = 'none';
}

async function switchKBTab(visaType) {
    currentKBVisaType = visaType;

    // Load data if not already loaded
    if (!knowledgeData[visaType]) {
        await loadKnowledgeData(visaType);
    }

    // Display the data
    displayKnowledgeData(visaType);

    // Update active tab
    setActiveKBTab(visaType);
}

function setActiveKBTab(visaType) {
    const tabs = document.querySelectorAll('.kb-tab');
    tabs.forEach(tab => {
        if (tab.textContent.includes(visaType + 'ビザ')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

async function loadKnowledgeData(visaType) {
    try {
        const response = await fetch(`/api/visa/knowledge?type=${visaType}`);
        const data = await response.json();

        if (data.success) {
            knowledgeData[visaType] = data.knowledge;
        } else {
            console.error('Failed to load knowledge data:', data.error);
            alert('知識データの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Error loading knowledge data:', error);
        alert('知識データの読み込み中にエラーが発生しました');
    }
}

function displayKnowledgeData(visaType) {
    const knowledge = knowledgeData[visaType];
    if (!knowledge) return;

    // Display visa info
    const visaInfoDiv = document.getElementById('kbVisaInfo');
    visaInfoDiv.innerHTML = `
        <div class="kb-visa-info">
            <h4>${knowledge.visa_type.name}</h4>
            <p>${knowledge.visa_type.description}</p>
            ${knowledge.visa_type.requirements ? `<p><strong>要件:</strong> ${knowledge.visa_type.requirements}</p>` : ''}
        </div>
    `;

    // Display tree visualization
    const treeDiv = document.getElementById('kbTree');
    treeDiv.innerHTML = '';

    const nodes = knowledge.decision_tree.nodes;
    const rootNode = knowledge.decision_tree.root;

    const treeHtml = buildTreeVisualization(rootNode, nodes, new Set());
    treeDiv.innerHTML = `
        <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">🗺️</span>
                <span>決定木フローチャート</span>
            </div>
            <div style="font-size: 14px; line-height: 1.8; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
                <div style="margin-bottom: 8px;"><strong>📌 見方：</strong></div>
                <div style="padding-left: 10px;">
                    ✦ 青枠の <span style="background: #3b82f6; padding: 2px 8px; border-radius: 3px; font-weight: 600;">開始</span> から読み始めます<br>
                    ✦ 各カードは質問を表示（「はい」「いいえ」で次に進む）<br>
                    ✦ <span style="background: #10b981; padding: 2px 8px; border-radius: 3px; font-weight: 600;">✅ 承認</span> = ビザ申請可能 / <span style="background: #ef4444; padding: 2px 8px; border-radius: 3px; font-weight: 600;">❌ 不承認</span> = 要件未達<br>
                    ✦ ノードID（白いボックス）をクリック → 下の詳細一覧にジャンプ
                </div>
            </div>
        </div>
        ${treeHtml}
    `;

    // Display nodes
    const nodesDiv = document.getElementById('kbNodes');
    nodesDiv.innerHTML = '';

    // Add root indicator
    Object.keys(nodes).forEach(nodeId => {
        const node = nodes[nodeId];
        const nodeElement = createKBNodeElement(nodeId, node, nodeId === rootNode);
        nodesDiv.appendChild(nodeElement);
    });
}

function buildTreeVisualization(nodeId, nodes, visited, depth = 0) {
    if (visited.has(nodeId) || depth > 50) {
        return `<div class="kb-tree-node" style="color: #ef4444; padding: 10px; margin: 5px 0;">⚠️ 循環参照または深さ制限</div>`;
    }

    visited.add(nodeId);

    const node = nodes[nodeId];
    if (!node) {
        return `<div class="kb-tree-node" style="color: #ef4444; padding: 10px; margin: 5px 0;">⚠️ ノード ${nodeId} が見つかりません</div>`;
    }

    const isRoot = depth === 0;
    const isResult = node.type === 'result';

    let html = '<div class="kb-tree-node" style="margin: 10px 0;">';

    // Node content - カード形式
    const bgColor = isResult
        ? (node.decision === 'approved' ? '#d1fae5' : '#fee2e2')
        : (isRoot ? '#dbeafe' : '#f3f4f6');
    const borderColor = isResult
        ? (node.decision === 'approved' ? '#10b981' : '#ef4444')
        : (isRoot ? '#3b82f6' : '#9ca3af');

    html += `<div class="kb-tree-node-content" style="
        background: ${bgColor};
        border: 2px solid ${borderColor};
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    ">`;

    html += `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">`;
    html += `<span class="kb-tree-node-id" onclick="scrollToNode('${nodeId}')" style="
        cursor: pointer;
        background: white;
        padding: 4px 10px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 12px;
        color: ${borderColor};
        border: 1px solid ${borderColor};
    " title="クリックして詳細を表示">${nodeId}</span>`;

    if (isRoot) {
        html += `<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">開始</span>`;
    }

    if (isResult) {
        const resultIcon = node.decision === 'approved' ? '✅' : '❌';
        const resultLabel = node.decision === 'approved' ? '承認' : '不承認';
        html += `<span style="background: ${borderColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${resultIcon} ${resultLabel}</span>`;
    }
    html += `</div>`;

    if (isResult) {
        html += `<div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${node.title || ''}</div>`;
        if (node.message) {
            html += `<div style="color: #6b7280; font-size: 14px;">${node.message}</div>`;
        }
    } else {
        const questionText = node.question || '';
        html += `<div style="color: #1f2937; font-weight: 500; line-height: 1.5;">${questionText}</div>`;
    }

    html += '</div>';

    // Branches - 見やすいインデント
    if (!isResult && node.type === 'boolean') {
        html += '<div style="margin-left: 30px; position: relative;">';

        if (node.yes) {
            html += `<div style="margin-top: 15px;">`;
            html += `<div class="kb-tree-branch kb-tree-branch-yes" style="
                color: #10b981;
                font-weight: 600;
                margin-bottom: 8px;
                padding: 6px 12px;
                background: #d1fae5;
                border-radius: 4px;
                display: inline-block;
            ">✓ はい の場合</div>`;
            html += buildTreeVisualization(node.yes, nodes, new Set(visited), depth + 1);
            html += `</div>`;
        }

        if (node.no) {
            html += `<div style="margin-top: 15px;">`;
            html += `<div class="kb-tree-branch kb-tree-branch-no" style="
                color: #ef4444;
                font-weight: 600;
                margin-bottom: 8px;
                padding: 6px 12px;
                background: #fee2e2;
                border-radius: 4px;
                display: inline-block;
            ">✗ いいえ の場合</div>`;
            html += buildTreeVisualization(node.no, nodes, new Set(visited), depth + 1);
            html += `</div>`;
        }

        html += '</div>';
    }

    html += '</div>';
    return html;
}

function scrollToNode(nodeId) {
    const nodeElement = document.querySelector(`.kb-node[data-node-id="${nodeId}"]`);
    if (nodeElement) {
        nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nodeElement.style.background = '#fef3c7';
        setTimeout(() => {
            nodeElement.style.background = '#f8fafc';
        }, 2000);
    }
}

function createKBNodeElement(nodeId, node, isRoot) {
    const div = document.createElement('div');
    div.className = 'kb-node';
    div.setAttribute('data-node-id', nodeId);
    div.setAttribute('data-question', node.question || node.title || '');

    const isResult = node.type === 'result';
    const typeLabel = isResult ? 'result' : (node.type || 'question');

    let html = `
        <div class="kb-node-header">
            <span class="kb-node-id">${nodeId}${isRoot ? ' (ROOT)' : ''}</span>
            <span class="kb-node-type ${typeLabel}">${typeLabel}</span>
        </div>
        <div class="kb-node-question">${node.question || node.title || node.message || ''}</div>
    `;

    // Add options if it's a question
    if (!isResult) {
        html += '<div class="kb-node-options">';

        if (node.type === 'boolean') {
            html += `
                <div class="kb-node-option">
                    <i class="fas fa-check"></i>
                    <span>はい</span>
                    <span class="kb-node-next">→ ${node.yes}</span>
                </div>
                <div class="kb-node-option">
                    <i class="fas fa-times"></i>
                    <span>いいえ</span>
                    <span class="kb-node-next">→ ${node.no}</span>
                </div>
            `;
        } else if (node.type === 'multiple_choice' && node.options) {
            node.options.forEach(option => {
                html += `
                    <div class="kb-node-option">
                        <i class="fas fa-arrow-right"></i>
                        <span>${option.text}</span>
                        <span class="kb-node-next">→ ${option.next}</span>
                    </div>
                `;
            });
        }

        html += '</div>';
    } else {
        // Display result details
        if (node.decision) {
            const decisionColor = node.decision === 'approved' ? '#10b981' : '#ef4444';
            html += `<div style="margin-top: 12px; padding: 8px 12px; background: ${decisionColor}; color: white; border-radius: 4px; font-weight: 600;">
                判定: ${node.decision === 'approved' ? '承認' : '不承認'}
            </div>`;
        }
    }

    div.innerHTML = html;
    return div;
}

function filterKBNodes() {
    const searchInput = document.getElementById('kbSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const nodes = document.querySelectorAll('.kb-node');

    nodes.forEach(node => {
        const nodeId = node.getAttribute('data-node-id').toLowerCase();
        const question = node.getAttribute('data-question').toLowerCase();

        if (nodeId.includes(searchTerm) || question.includes(searchTerm)) {
            node.style.display = 'block';
        } else {
            node.style.display = 'none';
        }
    });
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('knowledgeModal');
    if (event.target === modal) {
        closeKnowledgeDB();
    }
});
