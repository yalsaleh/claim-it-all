import {
  NOTICE_GENERATOR_VERSION,
  NOTICE_TEMPLATE_VERSION,
  type AssembledSection,
  type DraftContext,
  type NoticeFactInput,
  type NoticeSectionType,
} from './types';

function approvedFacts(facts: NoticeFactInput[]): NoticeFactInput[] {
  return facts.filter(
    (f) =>
      f.approvedForDrafting &&
      (f.verificationStatus === 'EVIDENCE_BACKED' || f.verificationStatus === 'HUMAN_CONFIRMED'),
  );
}

function factValue(facts: NoticeFactInput[], type: string): NoticeFactInput | undefined {
  return facts.find((f) => f.factType === type);
}

function headingFor(section: NoticeSectionType, language: 'en' | 'ar'): string {
  const en: Record<NoticeSectionType, string> = {
    SENDER: 'From',
    RECIPIENT: 'To',
    PROJECT_CONTRACT_REFERENCE: 'Project and contract',
    NOTICE_TITLE: 'Notice',
    CONTRACTUAL_BASIS: 'Contractual basis',
    FACTUAL_BACKGROUND: 'Background',
    EVENT_DESCRIPTION: 'Description of event',
    TRIGGER_DATE: 'Relevant dates',
    DEADLINE_STATEMENT: 'Contractual notice deadline',
    IMPACT_STATEMENT: 'Effect',
    RESERVATION_OF_RIGHTS: 'Reservation of rights',
    REQUESTED_ACTION: 'Requested action',
    RECORDS_EVIDENCE: 'Supporting records',
    CONTINUING_EVENT: 'Continuing event',
    ATTACHMENTS: 'Attachments',
    CLOSING: 'Closing',
  };
  const ar: Record<NoticeSectionType, string> = {
    SENDER: 'من',
    RECIPIENT: 'إلى',
    PROJECT_CONTRACT_REFERENCE: 'المشروع والعقد',
    NOTICE_TITLE: 'إشعار',
    CONTRACTUAL_BASIS: 'الأساس التعاقدي',
    FACTUAL_BACKGROUND: 'الخلفية',
    EVENT_DESCRIPTION: 'وصف الحدث',
    TRIGGER_DATE: 'التواريخ ذات الصلة',
    DEADLINE_STATEMENT: 'الموعد النهائي التعاقدي للإشعار',
    IMPACT_STATEMENT: 'الأثر',
    RESERVATION_OF_RIGHTS: 'التحفظ على الحقوق',
    REQUESTED_ACTION: 'الإجراء المطلوب',
    RECORDS_EVIDENCE: 'السجلات الداعمة',
    CONTINUING_EVENT: 'حدث مستمر',
    ATTACHMENTS: 'المرفقات',
    CLOSING: 'الخاتمة',
  };
  return language === 'ar' ? ar[section] : en[section];
}

function section(
  type: NoticeSectionType,
  sequence: number,
  language: 'en' | 'ar',
  body: string,
  sourceFactIds: string[],
  sourceClauseIds: string[],
  warnings: string[] = [],
  internalOnly = false,
): AssembledSection {
  return {
    sectionType: type,
    sequence,
    heading: headingFor(type, language),
    body: body.trim(),
    language,
    sourceFactIds,
    sourceEvidenceIds: [],
    sourceClauseIds,
    machineGenerated: true,
    humanEdited: false,
    internalOnly,
    warnings,
  };
}

/** Deterministic notice assembly — no AI required. */
export function assembleDeterministicDraft(ctx: DraftContext): {
  generatorVersion: string;
  templateVersion: string;
  sections: AssembledSection[];
} {
  const facts = approvedFacts(ctx.facts);
  const language = ctx.language;
  const clauseId = ctx.requirement.sourceClauseId ? [ctx.requirement.sourceClauseId] : [];
  const clauseRef =
    ctx.requirement.sourceClauseReference ?? 'clause reference on approved snapshot';
  const sections: AssembledSection[] = [];
  let seq = 1;

  const party = factValue(facts, 'PARTY_NAME');
  const senderBody =
    language === 'ar'
      ? `المرسل: ${party?.value ?? 'الطرف المتعاقد (يُستكمل)'}`
      : `Sender: ${party?.value ?? 'Contracting party (to be completed)'}`;
  sections.push(
    section(
      'SENDER',
      seq++,
      language,
      senderBody,
      party ? [party.id] : [],
      [],
      party ? [] : ['MISSING_SENDER_FACT'],
    ),
  );

  const primaryRecipients = ctx.recipients.filter((r) => !r.copiedRecipient);
  const recipientLines = primaryRecipients.map((r) => {
    const addr = r.emailAddress || r.physicalAddress || 'address pending verification';
    return `${r.recipientLabel} via ${r.selectedMethod ?? r.permittedMethod ?? 'method pending'} (${addr}) [${r.verificationStatus}]`;
  });
  sections.push(
    section(
      'RECIPIENT',
      seq++,
      language,
      recipientLines.length > 0
        ? recipientLines.join('\n')
        : language === 'ar'
          ? 'المستلم: غير مُتحقق بعد'
          : 'Recipient: not yet verified',
      [],
      [],
      primaryRecipients.some((r) => r.verificationStatus !== 'VERIFIED')
        ? ['UNVERIFIED_RECIPIENT']
        : [],
    ),
  );

  const contractRef = factValue(facts, 'CONTRACT_REFERENCE');
  sections.push(
    section(
      'PROJECT_CONTRACT_REFERENCE',
      seq++,
      language,
      language === 'ar'
        ? `المشروع: ${ctx.projectName} (${ctx.projectCode})\nمرجع العقد: ${contractRef?.value ?? ctx.contractReference}`
        : `Project: ${ctx.projectName} (${ctx.projectCode})\nContract reference: ${contractRef?.value ?? ctx.contractReference}`,
      contractRef ? [contractRef.id] : [],
      [],
    ),
  );

  const noticeRef = factValue(facts, 'NOTICE_REFERENCE');
  sections.push(
    section(
      'NOTICE_TITLE',
      seq++,
      language,
      `${ctx.title}${noticeRef ? ` — ${noticeRef.value}` : ''}\nType: ${ctx.noticeType}`,
      noticeRef ? [noticeRef.id] : [],
      [],
    ),
  );

  sections.push(
    section(
      'CONTRACTUAL_BASIS',
      seq++,
      language,
      language === 'ar'
        ? `يُقدَّم هذا الإشعار استناداً إلى ${clauseRef} وفقاً للتكوين المعتمد ولقطة القاعدة المعتمدة.`
        : `This notice is given under ${clauseRef} pursuant to the approved configuration and approved notice-rule snapshot.`,
      [],
      clauseId,
    ),
  );

  const description = factValue(facts, 'DESCRIPTION_OF_EVENT');
  sections.push(
    section(
      'FACTUAL_BACKGROUND',
      seq++,
      language,
      description?.value ?? ctx.eventDescription ?? ctx.eventTitle,
      description ? [description.id] : [],
      [],
      description ? [] : ['EVENT_DESCRIPTION_FROM_TITLE_ONLY'],
    ),
  );

  sections.push(
    section(
      'EVENT_DESCRIPTION',
      seq++,
      language,
      description?.value ?? ctx.eventTitle,
      description ? [description.id] : [],
      [],
    ),
  );

  const eventDate = factValue(facts, 'EVENT_DATE');
  const awareness = factValue(facts, 'AWARENESS_DATE');
  const dateLines = [
    eventDate
      ? language === 'ar'
        ? `تاريخ الحدث: ${eventDate.value}`
        : `Event date: ${eventDate.value}`
      : null,
    awareness
      ? language === 'ar'
        ? `تاريخ العلم: ${awareness.value}`
        : `Awareness date: ${awareness.value}`
      : null,
  ].filter(Boolean);
  sections.push(
    section(
      'TRIGGER_DATE',
      seq++,
      language,
      dateLines.join('\n') ||
        (language === 'ar' ? 'التواريخ قيد التحقق' : 'Dates pending verification'),
      [eventDate?.id, awareness?.id].filter(Boolean) as string[],
      [],
      eventDate ? [] : ['MISSING_EVENT_DATE_FACT'],
    ),
  );

  const deadline =
    ctx.requirement.verifiedDeadlineAt != null
      ? `${ctx.requirement.verifiedDeadlineAt}${ctx.requirement.verifiedDeadlineTimezone ? ` (${ctx.requirement.verifiedDeadlineTimezone})` : ''}`
      : null;
  sections.push(
    section(
      'DEADLINE_STATEMENT',
      seq++,
      language,
      deadline
        ? language === 'ar'
          ? `الموعد النهائي التعاقدي المحسوب والمتحقق: ${deadline}. تحذيرات داخلية ليست مواعيد تعاقدية.`
          : `Verified contractual notice deadline: ${deadline}. Internal warning dates are not contractual deadlines.`
        : language === 'ar'
          ? 'لا يوجد موعد نهائي متحقق مرتبط.'
          : 'No verified contractual deadline is bound to this package.',
      [],
      clauseId,
      deadline ? [] : ['MISSING_VERIFIED_DEADLINE'],
    ),
  );

  const effect = factValue(facts, 'DESCRIPTION_OF_EFFECT');
  if (effect) {
    sections.push(section('IMPACT_STATEMENT', seq++, language, effect.value, [effect.id], []));
  }

  const reservation =
    ctx.requirement.reservationLanguage?.trim() ||
    (language === 'ar'
      ? 'نحتفظ بجميع الحقوق والتعويضات بموجب العقد والقانون المعمول به.'
      : 'All rights and remedies under the contract and applicable law are reserved.');
  sections.push(section('RESERVATION_OF_RIGHTS', seq++, language, reservation, [], clauseId));

  const action = factValue(facts, 'REQUESTED_ACTION');
  sections.push(
    section(
      'REQUESTED_ACTION',
      seq++,
      language,
      action?.value ??
        (language === 'ar'
          ? 'يرجى الإقرار باستلام هذا الإشعار والتعامل معه وفقاً للعقد.'
          : 'Please acknowledge receipt of this notice and deal with it in accordance with the contract.'),
      action ? [action.id] : [],
      [],
    ),
  );

  const contentReq = ctx.requirement.contentRequirements;
  sections.push(
    section(
      'RECORDS_EVIDENCE',
      seq++,
      language,
      contentReq
        ? language === 'ar'
          ? `متطلبات المحتوى من اللقطة المعتمدة: ${contentReq}`
          : `Content requirements from approved snapshot: ${contentReq}`
        : language === 'ar'
          ? 'السجلات المعاصرة المشار إليها في المرفقات تدعم هذا الإشعار.'
          : 'Contemporary records referenced in the attachments support this notice.',
      [],
      clauseId,
    ),
  );

  if (ctx.requirement.continuingEventRequirements) {
    sections.push(
      section(
        'CONTINUING_EVENT',
        seq++,
        language,
        ctx.requirement.continuingEventRequirements,
        [],
        clauseId,
      ),
    );
  }

  const included = ctx.attachments.filter((a) => a.inclusionStatus === 'INCLUDED');
  sections.push(
    section(
      'ATTACHMENTS',
      seq++,
      language,
      included.length > 0
        ? included
            .map(
              (a, i) =>
                `${i + 1}. ${a.externalFilename}${a.description ? ` — ${a.description}` : ''}`,
            )
            .join('\n')
        : language === 'ar'
          ? 'لا مرفقات مضمّنة بعد.'
          : 'No attachments included yet.',
      [],
      [],
    ),
  );

  sections.push(
    section(
      'CLOSING',
      seq++,
      language,
      language === 'ar'
        ? 'وتفضلوا بقبول فائق الاحترام.\n[موضع التوقيع / السلطة — للمراجعة البشرية]'
        : 'Yours faithfully,\n[Signature / authority placeholder — human completion required]',
      [],
      [],
      ['SIGNATURE_PLACEHOLDER'],
    ),
  );

  // Internal guidance never exported
  sections.push(
    section(
      'FACTUAL_BACKGROUND',
      seq++,
      language,
      '[INTERNAL] Draft assembled deterministically. Do not present internal warning dates as contractual deadlines.',
      [],
      [],
      [],
      true,
    ),
  );

  return {
    generatorVersion: NOTICE_GENERATOR_VERSION,
    templateVersion: ctx.templateVersion || NOTICE_TEMPLATE_VERSION,
    sections: sections.filter((s) => s.body.length > 0),
  };
}

export function renderPlainText(
  sections: AssembledSection[],
  opts?: { includeInternal?: boolean },
): string {
  const includeInternal = opts?.includeInternal ?? false;
  return sections
    .filter((s) => includeInternal || !s.internalOnly)
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => `${s.heading}\n${s.body}`)
    .join('\n\n');
}
