"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectCodexEvent = projectCodexEvent;
const fileChangeExtractor_1 = require("../../chat/fileChangeExtractor");
const skillCallMarker_1 = require("../../chat/skillCallMarker");
const attachmentPathRedaction_1 = require("../../chat/attachmentPathRedaction");
const extractIds_1 = require("./extractIds");
/**
 * 提取并归一化 `item/completed` 的 item.type，兼容 snake_case / 大小写差异。
 */
function resolveCompletedItemType(params) {
    const rawItemType = String(params?.item?.type ?? params?.itemType ?? params?.item_type ?? "");
    return rawItemType.trim().toLowerCase();
}
/**
 * 聚合 commandExecution 的可展示文本，优先输出 aggregatedOutput。
 */
function buildCommandExecutionFinalText(params) {
    const aggregatedOutput = String(params?.item?.aggregatedOutput ?? "");
    if (aggregatedOutput)
        return aggregatedOutput;
    const fallbackText = String(params?.item?.text ?? "");
    if (fallbackText)
        return fallbackText;
    return String(params?.item?.command ?? "");
}
/**
 * 生成 command_execution 历史消息类型。
 *
 * 说明：
 * - 默认值仍为 `command_execution`；
 * - 命中 skill 调用时附带 `:<skillName>`，便于 history query 恢复结构化标记。
 */
function buildCommandExecutionMessageType(params) {
    const marker = (0, skillCallMarker_1.extractSkillCallMarkerFromCommandExecutionItem)(params?.item ?? params);
    if (!marker?.name)
        return "command_execution";
    return `command_execution_skill:${marker.name}`;
}
/**
 * 从 userMessage item 中提取可展示文本，并对附件路径做脱敏。
 */
function buildUserMessageFinalText(item) {
    const it = item;
    const directText = typeof it?.text === "string" ? it.text : "";
    if (directText.trim())
        return (0, attachmentPathRedaction_1.redactAttachmentPathsForDisplay)(directText.trim());
    const directMessage = typeof it?.message === "string" ? it.message : "";
    if (directMessage.trim())
        return (0, attachmentPathRedaction_1.redactAttachmentPathsForDisplay)(directMessage.trim());
    const parts = Array.isArray(it?.content)
        ? it.content
        : Array.isArray(it?.contentItems)
            ? it.contentItems
            : [];
    const rawText = parts
        .map((part) => {
        const record = part;
        if (typeof record === "string")
            return record;
        if (typeof record?.text === "string")
            return record.text;
        if (typeof record?.value === "string")
            return record.value;
        return "";
    })
        .filter(Boolean)
        .join("")
        .trim();
    if (!rawText)
        return "";
    return (0, attachmentPathRedaction_1.redactAttachmentPathsForDisplay)(rawText);
}
/**
 * 生成 fileChange 的最终展示文本，默认使用稳定标题。
 */
function buildFileChangeFinalText(params) {
    const title = String(params?.item?.title ?? "").trim();
    if (title)
        return title;
    const text = String(params?.item?.text ?? "").trim();
    if (text)
        return text;
    return "文件变更";
}
/**
 * 归一化 summaryIndex，兼容非数字与负值输入。
 */
function normalizeSummaryIndex(rawSummaryIndex) {
    const parsedSummaryIndex = Number(rawSummaryIndex);
    if (!Number.isFinite(parsedSummaryIndex))
        return 0;
    return Math.max(0, Math.floor(parsedSummaryIndex));
}
/**
 * 将 reasoning completed 的 summary 数组展开为多条 done 消息。
 */
function buildReasoningCompletedMessages(threadId, turnId, itemId, params, nowMs) {
    const summaryItems = Array.isArray(params?.item?.summary) ? params.item.summary : [];
    const messages = [];
    for (let summaryIndex = 0; summaryIndex < summaryItems.length; summaryIndex += 1) {
        const finalText = String(summaryItems[summaryIndex] ?? "").trim();
        if (!finalText)
            continue;
        const messageId = (0, extractIds_1.buildReasoningSummaryMessageId)(turnId, itemId, summaryIndex);
        if (!messageId)
            continue;
        messages.push({
            threadId,
            messageId,
            role: "reasoning",
            messageType: "reasoning_summary",
            status: "done",
            finalText,
            finishedAtMs: nowMs,
            updatedAtMs: nowMs,
        });
    }
    return messages;
}
/**
 * 归一化计划步骤状态，兼容 camelCase / snake_case / done。
 */
function normalizePlanStepStatus(rawStatus) {
    if (typeof rawStatus !== "string")
        return null;
    const normalizedStatus = rawStatus
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    if (!normalizedStatus)
        return null;
    if (normalizedStatus === "pending")
        return "pending";
    if (normalizedStatus === "completed" || normalizedStatus === "done")
        return "completed";
    if (normalizedStatus === "in_progress" || normalizedStatus === "inprogress" || normalizedStatus === "doing")
        return "in_progress";
    return null;
}
/**
 * 从未知结构中提取计划步骤文本。
 */
function extractPlanStepText(rawStep) {
    if (typeof rawStep === "string")
        return rawStep.trim();
    if (!rawStep || typeof rawStep !== "object")
        return "";
    const stepRecord = rawStep;
    const candidates = [
        stepRecord.step,
        stepRecord.text,
        stepRecord.title,
        stepRecord.description,
        stepRecord.name,
        stepRecord.task,
        stepRecord.label,
    ];
    for (const candidate of candidates) {
        if (typeof candidate !== "string")
            continue;
        const normalizedStepText = candidate.trim();
        if (normalizedStepText)
            return normalizedStepText;
    }
    return "";
}
/**
 * 从 `plan/steps/items` 字段中提取标准化步骤数组。
 */
function extractNormalizedPlanSteps(rawContainer) {
    if (!rawContainer || typeof rawContainer !== "object")
        return [];
    const container = rawContainer;
    const sources = [container.plan, container.steps, container.items];
    const normalizedSteps = [];
    for (const rawSource of sources) {
        if (!Array.isArray(rawSource))
            continue;
        for (const rawStep of rawSource) {
            const stepText = extractPlanStepText(rawStep);
            if (!stepText)
                continue;
            const stepRecord = rawStep && typeof rawStep === "object" ? rawStep : {};
            const statusFromStatus = normalizePlanStepStatus(stepRecord.status);
            const statusFromState = normalizePlanStepStatus(stepRecord.state);
            const completedFlag = typeof stepRecord.completed === "boolean" ? stepRecord.completed : null;
            const inProgressFlag = typeof stepRecord.inProgress === "boolean" ? stepRecord.inProgress : null;
            const inProgressSnakeFlag = typeof stepRecord.in_progress === "boolean" ? stepRecord.in_progress : null;
            const resolvedStatus = statusFromStatus ??
                statusFromState ??
                (inProgressFlag || inProgressSnakeFlag ? "in_progress" : null) ??
                (completedFlag === null ? null : completedFlag ? "completed" : "pending") ??
                "pending";
            normalizedSteps.push({
                status: resolvedStatus,
                step: stepText,
            });
        }
        if (normalizedSteps.length)
            return normalizedSteps;
    }
    return normalizedSteps;
}
/**
 * 把结构化计划组装为可展示且可解析的 TODO 文本。
 */
function buildPlanText(rawPlan) {
    if (!rawPlan || typeof rawPlan !== "object")
        return "";
    const planRecord = rawPlan;
    const explanationFromField = typeof planRecord.explanation === "string" ? planRecord.explanation.trim() : "";
    const summaryFromArray = Array.isArray(planRecord.summary)
        ? planRecord.summary
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
            .join("\n")
        : "";
    const explanation = explanationFromField || summaryFromArray;
    const normalizedSteps = extractNormalizedPlanSteps(planRecord);
    if (!normalizedSteps.length)
        return explanation;
    const stepLines = normalizedSteps.map((step) => `- (${step.status}) ${step.step}`);
    if (!explanation)
        return stepLines.join("\n");
    return `${explanation}\n${stepLines.join("\n")}`.trim();
}
/**
 * 生成 plan completed 的最终文本，优先使用已有 text。
 */
function buildPlanCompletedFinalText(params) {
    const directText = String(params?.item?.text ?? "").trim();
    if (directText)
        return directText;
    return buildPlanText(params?.item ?? {});
}
/**
 * 生成 turn/plan/updated 的最终文本。
 */
function buildTurnPlanUpdatedFinalText(params) {
    return buildPlanText(params ?? {});
}
/**
 * 安全序列化对象，避免异常中断历史投影。
 */
function safeJsonStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value ?? "");
    }
}
/**
 * 统一选项标签文本，避免装饰后缀影响匹配。
 */
function normalizeUserInputOptionLabel(value) {
    let normalizedLabel = String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    normalizedLabel = normalizedLabel.replace(/\s*\((?:recommended|推荐)\)\s*$/i, "").trim();
    normalizedLabel = normalizedLabel.replace(/\s*（(?:recommended|推荐)）\s*$/i, "").trim();
    return normalizedLabel;
}
/**
 * 审核记录里的“审核类型”字段标签。
 */
const APPROVAL_AUDIT_METHOD_LABEL = "审核类型";
/**
 * 审核记录里的“审核结论”字段标签。
 */
const APPROVAL_AUDIT_DECISION_LABEL = "审核结论";
/**
 * 从候选值中提取首个非空字符串。
 */
function pickFirstNonEmptyString(candidates) {
    for (const candidate of candidates) {
        if (typeof candidate !== "string")
            continue;
        const normalizedValue = candidate.trim();
        if (normalizedValue)
            return normalizedValue;
    }
    return "";
}
/**
 * 从审核请求参数中提取命令文本（若存在）。
 */
function extractApprovalCommand(rawParams) {
    const params = (rawParams ?? {});
    return pickFirstNonEmptyString([params?.item?.command, params?.command, params?.proposed?.command, params?.request?.command]);
}
/**
 * 从审核请求参数中提取审批理由文本。
 */
function extractApprovalReason(rawParams) {
    const params = (rawParams ?? {});
    return pickFirstNonEmptyString([params?.reason, params?.prompt, params?.message, params?.request?.reason, params?.item?.reason]);
}
/**
 * 从审核请求参数中提取工作目录文本。
 */
function extractApprovalCwd(rawParams) {
    const params = (rawParams ?? {});
    return pickFirstNonEmptyString([params?.cwd, params?.workingDirectory, params?.request?.cwd]);
}
/**
 * 从审核请求参数中提取被审核 itemId。
 */
function extractApprovalItemId(rawParams) {
    const params = (rawParams ?? {});
    return pickFirstNonEmptyString([params?.itemId, params?.item_id, params?.item?.id]);
}
/**
 * 从审核请求参数中提取可读上下文。
 */
function extractApprovalRequestContext(rawParams) {
    return {
        reason: extractApprovalReason(rawParams),
        command: extractApprovalCommand(rawParams),
        cwd: extractApprovalCwd(rawParams),
        itemId: extractApprovalItemId(rawParams),
    };
}
/**
 * 组装审核上下文展示行，帮助定位“审核的具体对象”。
 */
function buildApprovalContextLines(rawParams) {
    const approvalContext = extractApprovalRequestContext(rawParams);
    const contextLines = [];
    if (approvalContext.reason)
        contextLines.push(`- reason: ${approvalContext.reason}`);
    if (approvalContext.command)
        contextLines.push(`- command: ${approvalContext.command}`);
    if (approvalContext.cwd)
        contextLines.push(`- cwd: ${approvalContext.cwd}`);
    if (!approvalContext.command && approvalContext.itemId)
        contextLines.push(`- itemId: ${approvalContext.itemId}`);
    return contextLines;
}
/**
 * 组装 fileChange 审核请求的“本次变动文件”展示行。
 */
function buildApprovalFileChangesLines(method, rawParams) {
    if (method !== "item/fileChange/requestApproval")
        return [];
    const fileChanges = (0, fileChangeExtractor_1.extractFileChangesFromAny)(rawParams);
    if (!fileChanges.length)
        return [];
    const labels = fileChanges
        .map((fileChange) => {
        const normalizedPath = String(fileChange.path ?? "").trim();
        if (!normalizedPath)
            return "";
        const normalizedKind = String(fileChange.kind ?? "change").trim() || "change";
        return `${normalizedPath} (${normalizedKind})`;
    })
        .filter(Boolean);
    if (!labels.length)
        return [];
    return [`- 本次变动文件: ${labels.join(" / ")}`];
}
/**
 * 构造 `web/user_input_required` 的消息类型与可读文本。
 */
function buildUserInputRequiredProjection(params) {
    const method = String(params?.method ?? "").trim();
    const rawMethodParams = params?.params ?? {};
    if (method === "item/tool/requestUserInput") {
        const questions = Array.isArray(rawMethodParams?.questions)
            ? rawMethodParams.questions
            : [];
        const lines = ["选择题请求"];
        if (questions.length) {
            for (const question of questions) {
                const questionId = String(question?.id ?? "").trim();
                const questionHeader = String(question?.header ?? "").trim();
                const questionText = String(question?.question ?? "").trim();
                const optionLabels = Array.isArray(question?.options)
                    ? question.options
                        .map((option) => String(option?.label ?? "").trim())
                        .filter(Boolean)
                    : [];
                const title = questionHeader || questionId || "未命名问题";
                lines.push(`- ${title}${questionText ? `: ${questionText}` : ""}`);
                if (optionLabels.length)
                    lines.push(`  选项: ${optionLabels.join(" / ")}`);
            }
        }
        else {
            lines.push(`- ${APPROVAL_AUDIT_METHOD_LABEL}: ${method}`);
            lines.push(`- payload: ${safeJsonStringify(rawMethodParams)}`);
        }
        return {
            messageType: "user_input_request",
            finalText: lines.join("\n"),
        };
    }
    const lines = ["审核请求", `- ${APPROVAL_AUDIT_METHOD_LABEL}: ${method || "unknown"}`];
    lines.push(...buildApprovalContextLines(rawMethodParams));
    lines.push(...buildApprovalFileChangesLines(method, rawMethodParams));
    return {
        messageType: "approval_request",
        finalText: lines.join("\n"),
    };
}
/**
 * 从响应载荷中提取选择题答案列表文本。
 */
function extractChoiceAnswerLines(rawResponse) {
    const response = (rawResponse ?? {});
    const answers = response?.answers;
    if (!answers || typeof answers !== "object")
        return [];
    const lines = [];
    for (const [questionId, answerValue] of Object.entries(answers)) {
        const normalizedQuestionId = String(questionId ?? "").trim() || "unknown";
        const rawAnswers = Array.isArray(answerValue?.answers)
            ? answerValue.answers
            : Array.isArray(answerValue)
                ? answerValue
                : [answerValue];
        const normalizedAnswers = rawAnswers
            .map((value) => String(value ?? "").trim())
            .filter(Boolean);
        if (!normalizedAnswers.length)
            continue;
        const markedAnswers = normalizedAnswers.map((answerText) => {
            if (/[✓✔]$/u.test(answerText))
                return answerText;
            return `${answerText}✓`;
        });
        lines.push(`- ${normalizedQuestionId}`);
        lines.push(`  选项: ${markedAnswers.join(" / ")}`);
    }
    return lines;
}
/**
 * 从响应中提取 questionId -> answers 映射。
 */
function extractChoiceAnswerMap(rawResponse) {
    const response = (rawResponse ?? {});
    const answers = response?.answers;
    if (!answers || typeof answers !== "object")
        return {};
    const answerMap = {};
    for (const [questionId, answerValue] of Object.entries(answers)) {
        const normalizedQuestionId = String(questionId ?? "").trim();
        if (!normalizedQuestionId)
            continue;
        const rawAnswers = Array.isArray(answerValue?.answers)
            ? answerValue.answers
            : Array.isArray(answerValue)
                ? answerValue
                : [answerValue];
        const normalizedAnswers = rawAnswers
            .map((value) => normalizeUserInputOptionLabel(value))
            .filter(Boolean);
        if (!normalizedAnswers.length)
            continue;
        answerMap[normalizedQuestionId] = normalizedAnswers;
    }
    return answerMap;
}
/**
 * 按问题选项输出带勾选标记的结果行。
 */
function extractChoiceAnswerLinesWithOptions(rawResponse, requestParams) {
    const params = (requestParams ?? {});
    const questions = Array.isArray(params?.questions) ? params.questions : [];
    if (!questions.length)
        return extractChoiceAnswerLines(rawResponse);
    const answerMap = extractChoiceAnswerMap(rawResponse);
    const lines = [];
    for (const question of questions) {
        const questionId = String(question?.id ?? "").trim();
        if (!questionId)
            continue;
        const questionHeader = String(question?.header ?? "").trim();
        const questionText = String(question?.question ?? "").trim();
        const title = questionHeader || questionId;
        const selectedAnswers = new Set((answerMap[questionId] ?? []).map((answer) => normalizeUserInputOptionLabel(answer)));
        const optionLabels = Array.isArray(question?.options)
            ? question.options
                .map((option) => String(option?.label ?? "").trim())
                .filter(Boolean)
            : [];
        lines.push(`- ${title}${questionText ? `: ${questionText}` : ""}`);
        if (optionLabels.length) {
            // 选项标签在 map 阶段显式标注为 string，避免隐式 any。
            const markedOptions = optionLabels.map((optionLabel) => {
                const normalizedOptionLabel = normalizeUserInputOptionLabel(optionLabel);
                if (selectedAnswers.has(normalizedOptionLabel))
                    return `${optionLabel}✓`;
                return optionLabel;
            });
            lines.push(`  选项: ${markedOptions.join(" / ")}`);
            continue;
        }
        if (selectedAnswers.size) {
            lines.push(`  选项: ${Array.from(selectedAnswers).join(" / ")}✓`);
            continue;
        }
    }
    if (!lines.length)
        return extractChoiceAnswerLines(rawResponse);
    return lines;
}
/**
 * 从响应载荷中提取审核决策字符串。
 */
function extractApprovalDecision(rawResponse) {
    const response = (rawResponse ?? {});
    const decision = response?.decision;
    if (typeof decision === "string")
        return decision.trim();
    if (decision && typeof decision === "object" && !Array.isArray(decision)) {
        if (decision.acceptWithExecpolicyAmendment)
            return "acceptWithExecpolicyAmendment";
        if (decision.approved_execpolicy_amendment)
            return "approved_execpolicy_amendment";
        return safeJsonStringify(decision);
    }
    return "";
}
/**
 * 根据审批方法返回可选决策列表。
 */
function approvalDecisionOptionsByMethod(method) {
    if (method === "item/commandExecution/requestApproval") {
        return ["accept", "acceptForSession", "acceptWithExecpolicyAmendment", "decline", "cancel"];
    }
    if (method === "item/fileChange/requestApproval") {
        return ["accept", "acceptForSession", "decline", "cancel"];
    }
    if (method === "applyPatchApproval" || method === "execCommandApproval") {
        return ["approved", "approved_for_session", "approved_execpolicy_amendment", "denied", "abort"];
    }
    return [];
}
/**
 * 构造 `web/user_input_resolved` 的消息类型与可读文本。
 */
function buildUserInputResolvedProjection(params) {
    const method = String(params?.method ?? "").trim();
    const mappedResponse = params?.mappedResponse ?? params?.response ?? {};
    const requestParams = params?.requestParams ?? {};
    if (method === "item/tool/requestUserInput") {
        const lines = ["选择题结果"];
        const answerLines = extractChoiceAnswerLinesWithOptions(mappedResponse, requestParams);
        if (answerLines.length) {
            lines.push(...answerLines);
        }
        else {
            lines.push(`- ${APPROVAL_AUDIT_METHOD_LABEL}: ${method}`);
            lines.push(`- payload: ${safeJsonStringify(mappedResponse)}`);
        }
        return {
            messageType: "user_input_response",
            finalText: lines.join("\n"),
        };
    }
    const decision = extractApprovalDecision(mappedResponse);
    const lines = ["审核结果", `- ${APPROVAL_AUDIT_METHOD_LABEL}: ${method || "unknown"}`];
    lines.push(...buildApprovalContextLines(requestParams));
    lines.push(...buildApprovalFileChangesLines(method, requestParams));
    if (decision) {
        lines.push(`- ${APPROVAL_AUDIT_DECISION_LABEL}: ${decision}`);
        const optionLabels = approvalDecisionOptionsByMethod(method);
        if (decision && optionLabels.length && !optionLabels.includes(decision))
            optionLabels.push(decision);
        if (optionLabels.length) {
            const markedOptions = optionLabels.map((optionLabel) => (optionLabel === decision ? `${optionLabel}✓` : optionLabel));
            lines.push(`  选项: ${markedOptions.join(" / ")}`);
        }
    }
    else {
        lines.push(`- payload: ${safeJsonStringify(mappedResponse)}`);
    }
    return {
        messageType: "approval_response",
        finalText: lines.join("\n"),
    };
}
/**
 * 将 Codex 事件投影为结构化消息与增量片段。
 */
function projectCodexEvent(input) {
    // 统一做 method 归一化，降低上游字段类型波动带来的分支误判。
    const method = String(input.event?.method ?? "").trim();
    const params = (input.event?.params ?? {});
    if (method === "item/started") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const item = params?.item ?? null;
        const itemType = typeof item?.type === "string" ? String(item.type).trim() : "";
        const normalizedItemType = itemType.toLowerCase().replace(/[_\s-]+/g, "");
        if (normalizedItemType === "usermessage") {
            const messageId = (0, extractIds_1.buildUserMessageId)(turnId, itemId);
            const finalText = buildUserMessageFinalText(item);
            if (!messageId || !finalText)
                return {};
            return {
                message: {
                    threadId: input.threadId,
                    messageId,
                    role: "user",
                    messageType: "user_message",
                    status: "done",
                    finalText,
                    finishedAtMs: input.nowMs,
                    updatedAtMs: input.nowMs,
                },
            };
        }
    }
    if (method === "item/agentMessage/delta") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const messageId = (0, extractIds_1.buildAgentMessageId)(turnId, itemId);
        const deltaText = String(params?.delta ?? "");
        if (!messageId || !deltaText)
            return {};
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "assistant",
                messageType: "assistant_text",
                status: "streaming",
                startedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "item/plan/delta") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const messageId = (0, extractIds_1.buildPlanMessageId)(turnId, itemId);
        const deltaText = String(params?.delta ?? "");
        if (!messageId || !deltaText)
            return {};
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "assistant",
                messageType: "plan",
                status: "streaming",
                startedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "item/commandExecution/outputDelta") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const messageId = (0, extractIds_1.buildCommandExecutionMessageId)(turnId, itemId);
        const deltaText = String(params?.delta ?? "");
        if (!messageId || !deltaText)
            return {};
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "system",
                messageType: "command_execution",
                status: "streaming",
                startedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "item/fileChange/outputDelta") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const messageId = (0, extractIds_1.buildFileChangeMessageId)(turnId, itemId);
        const deltaText = String(params?.delta ?? "");
        if (!messageId || !deltaText)
            return {};
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "system",
                messageType: "file_change",
                status: "streaming",
                diffOutputDelta: deltaText,
                startedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "item/reasoning/summaryTextDelta") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const summaryIndex = normalizeSummaryIndex(params?.summaryIndex);
        const messageId = (0, extractIds_1.buildReasoningSummaryMessageId)(turnId, itemId, summaryIndex);
        const deltaText = String(params?.delta ?? "");
        if (!messageId || !deltaText)
            return {};
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "reasoning",
                messageType: "reasoning_summary",
                status: "streaming",
                startedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "web/user_input_required") {
        const projection = buildUserInputRequiredProjection(params);
        const messageId = (0, extractIds_1.buildUserInputAuditMessageId)(input.threadId, params?.requestId, "required");
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "system",
                messageType: projection.messageType,
                status: "done",
                finalText: projection.finalText,
                finishedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "web/user_input_resolved") {
        const projection = buildUserInputResolvedProjection(params);
        const messageId = (0, extractIds_1.buildUserInputAuditMessageId)(input.threadId, params?.requestId, "resolved");
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "system",
                messageType: projection.messageType,
                status: "done",
                finalText: projection.finalText,
                finishedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    if (method === "item/completed") {
        const itemType = resolveCompletedItemType(params);
        if (itemType === "usermessage") {
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messageId = (0, extractIds_1.buildUserMessageId)(turnId, itemId);
            if (!messageId)
                return {};
            const item = params?.item ?? null;
            const finalText = buildUserMessageFinalText(item);
            if (!finalText)
                return {};
            return {
                message: {
                    threadId: input.threadId,
                    messageId,
                    role: "user",
                    messageType: "user_message",
                    status: "done",
                    finalText,
                    finishedAtMs: input.nowMs,
                    updatedAtMs: input.nowMs,
                },
            };
        }
        if (itemType === "agentmessage") {
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messageId = (0, extractIds_1.buildAgentMessageId)(turnId, itemId);
            if (!messageId)
                return {};
            return {
                message: {
                    threadId: input.threadId,
                    messageId,
                    role: "assistant",
                    messageType: "assistant_text",
                    status: "done",
                    finalText: String(params?.item?.text ?? ""),
                    finishedAtMs: input.nowMs,
                    updatedAtMs: input.nowMs,
                },
            };
        }
        if (itemType === "commandexecution") {
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messageId = (0, extractIds_1.buildCommandExecutionMessageId)(turnId, itemId);
            if (!messageId)
                return {};
            return {
                message: {
                    threadId: input.threadId,
                    messageId,
                    role: "system",
                    messageType: buildCommandExecutionMessageType(params),
                    status: "done",
                    finalText: buildCommandExecutionFinalText(params),
                    finishedAtMs: input.nowMs,
                    updatedAtMs: input.nowMs,
                },
            };
        }
        if (itemType === "plan") {
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messageId = (0, extractIds_1.buildPlanMessageId)(turnId, itemId);
            if (!messageId)
                return {};
            return {
                message: {
                    threadId: input.threadId,
                    messageId,
                    role: "assistant",
                    messageType: "plan",
                    status: "done",
                    finalText: buildPlanCompletedFinalText(params),
                    finishedAtMs: input.nowMs,
                    updatedAtMs: input.nowMs,
                },
            };
        }
        if (itemType === "filechange") {
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messageId = (0, extractIds_1.buildFileChangeMessageId)(turnId, itemId);
            if (!messageId)
                return {};
            const item = params?.item ?? params;
            const changes = (0, fileChangeExtractor_1.extractFileChangesFromAny)(item);
            const diffChangesJson = changes.length ? JSON.stringify(changes) : "";
            const diffTitle = buildFileChangeFinalText(params);
            return {
                message: {
                    threadId: input.threadId,
                    messageId,
                    role: "system",
                    messageType: "file_change",
                    status: "done",
                    finalText: diffTitle,
                    diffTitle,
                    diffChangesJson,
                    finishedAtMs: input.nowMs,
                    updatedAtMs: input.nowMs,
                },
            };
        }
        if (itemType === "reasoning") {
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messages = buildReasoningCompletedMessages(input.threadId, turnId, itemId, params, input.nowMs);
            if (!messages.length)
                return {};
            return { messages };
        }
    }
    if (method === "turn/plan/updated") {
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const messageId = (0, extractIds_1.buildPlanMessageId)(turnId, "todo");
        if (!messageId)
            return {};
        return {
            message: {
                threadId: input.threadId,
                messageId,
                role: "assistant",
                messageType: "plan",
                status: "done",
                finalText: buildTurnPlanUpdatedFinalText(params),
                finishedAtMs: input.nowMs,
                updatedAtMs: input.nowMs,
            },
        };
    }
    return {};
}
//# sourceMappingURL=projectCodexEvent.js.map