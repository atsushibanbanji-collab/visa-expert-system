// Knowledge Database Page JavaScript

let knowledgeData = {};
let currentVisaType = 'E';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load E visa by default
    switchKBTab('E');
});

async function switchKBTab(visaType) {
    currentVisaType = visaType;

    // Update tab active state
    const tabs = document.querySelectorAll('.kb-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.kb-tab').classList.add('active');

    // Load knowledge data if not already loaded
    if (!knowledgeData[visaType]) {
        await loadKnowledgeData(visaType);
    }

    // Display the data
    displayKnowledgeData(visaType);
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
            <h4><i class="fas fa-passport"></i> ${knowledge.visa_type.name}</h4>
            <p><strong>説明：</strong> ${knowledge.visa_type.description}</p>
            ${knowledge.visa_type.requirements ? `<p><strong>主要要件：</strong> ${knowledge.visa_type.requirements}</p>` : ''}
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

    // Branches - 見やすいインデントと接続線
    if (!isResult && node.type === 'boolean') {
        html += '<div style="margin-left: 30px; position: relative; border-left: 3px solid #e5e7eb; padding-left: 20px;">';

        if (node.yes) {
            html += `<div style="margin-top: 15px; position: relative;">`;
            // 接続線（横線）
            html += `<div style="
                position: absolute;
                left: -20px;
                top: 30px;
                width: 20px;
                height: 3px;
                background: #10b981;
            "></div>`;
            html += `<div class="kb-tree-branch kb-tree-branch-yes" style="
                color: #10b981;
                font-weight: 600;
                margin-bottom: 8px;
                padding: 6px 12px;
                background: #d1fae5;
                border-radius: 4px;
                display: inline-block;
                border: 2px solid #10b981;
            ">✓ はい の場合</div>`;
            html += buildTreeVisualization(node.yes, nodes, new Set(visited), depth + 1);
            html += `</div>`;
        }

        if (node.no) {
            html += `<div style="margin-top: 15px; position: relative;">`;
            // 接続線（横線）
            html += `<div style="
                position: absolute;
                left: -20px;
                top: 30px;
                width: 20px;
                height: 3px;
                background: #ef4444;
            "></div>`;
            html += `<div class="kb-tree-branch kb-tree-branch-no" style="
                color: #ef4444;
                font-weight: 600;
                margin-bottom: 8px;
                padding: 6px 12px;
                background: #fee2e2;
                border-radius: 4px;
                display: inline-block;
                border: 2px solid #ef4444;
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
