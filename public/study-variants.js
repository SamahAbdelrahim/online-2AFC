const PARENT_CHILD_WELCOME_HTML = `
  <div class="sb-container sb-intro-page">
    <div class="sb-intro-logo-wrap">
      <img class="sb-intro-logo" src="/general_assets/stanford.png" alt="Stanford University logo" onerror="this.style.display='none'">
    </div>
    <h1 class="sb-page-title">Welcome</h1>
    <div class="sb-intro-copy">
      <p>By allowing your child to answer the following questions, you are agreeing to their participation in a study being performed by researchers in the Stanford Department of Psychology.</p>
      <p>Your child will see pairs of 3D shapes and choose which one is easier to draw. It takes about 10 minutes.</p>
      <p>If you have questions about this research, please contact us at: <a href="mailto:languagecoglab@gmail.com">languagecoglab@gmail.com</a></p>
      <p>You must be the child's parent or legal guardian to give permission. Taking part is voluntary. Your child can skip anything or stop at any time, with no penalty. Their responses are anonymous and used only for research.</p>
    </div>
  </div>`;

const EASIER_TO_DRAW_TRIAL = {
  trialTitle: "Which object is easier to draw?",
  trialSubtitle: "Drag objects below.",
  choiceButtons: ["A is Easier to Draw", "B is Easier to Draw"],
  choicePromptLocked: "Drag objects below.",
  choicePromptUnlocked: "Make your choice."
};

export const STUDY_VARIANTS = {
  complexity: {
    id: "complexity",
    experimentType: "complexity_comparison",
    dbgPrefix: "[SB-COMPLEXITY]",
    trialTitle: null,
    trialSubtitle: "Drag both objects to explore before making your choice.",
    choiceButtons: ["Object A Is More Complex", "Object B Is More Complex"],
    choicePromptLocked: "Drag both objects to explore before making your choice.",
    choicePromptUnlocked: "Please make your choice.",
    introPages: [
      `<div class="sb-container sb-intro-page">
        <div class="sb-intro-logo-wrap">
          <img class="sb-intro-logo" src="/general_assets/stanford.png" alt="Stanford University logo" onerror="this.style.display='none'">
        </div>
        <h1 class="sb-page-title">Welcome</h1>
        <div class="sb-intro-copy">
          <p>By answering the following questions, you are participating in a study being performed by researchers in the Stanford Department of Psychology.</p>
          <p>If you have questions about this research, please contact us at: <a href="mailto:languagecoglab@gmail.com">languagecoglab@gmail.com</a></p>
          <p>You must be at least 18 to take part. Participation is voluntary. You can skip any question or stop at any time, with no penalty. Your responses are anonymous and used only for research.</p>
        </div>
      </div>`,
      `<div class="sb-container sb-instruction-page">
        <h1 class="sb-page-title">Task Instructions</h1>
        <div class="sb-intro-copy">
          <p>In this experiment, you'll see pairs of 3D abstract objects.</p>
          <p>Click and drag to rotate or move each one.</p>
          <p>For each pair, decide which object looks <strong>more complex</strong>.<br>Go with your intuition. There are no right or wrong answers.</p>
          <p>Click next to begin.</p>
        </div>
      </div>`
    ]
  },
  online: {
    id: "online",
    experimentType: "parent_online_easier_to_draw",
    dbgPrefix: "[SB-PARENT-ONLINE]",
    ...EASIER_TO_DRAW_TRIAL,
    introPages: [
      PARENT_CHILD_WELCOME_HTML,
      `<div class="sb-container sb-instruction-page">
        <h1 class="sb-page-title">Task Instructions</h1>
        <p class="sb-page-subtitle">Parents, read this before continuing.</p>
        <div class="sb-intro-copy">
          <p>You'll both see pairs of 3D shapes on the screen. Show your child how to touch and drag each shape to turn it around.</p>
          <p>For each pair, ask your child: <strong>"Which one is easier to draw?"</strong></p>
          <p>Let them choose on their own. There are no right or wrong answers, so whatever they pick is fine. Try not to steer them. When your child is ready, click next to begin.</p>
        </div>
      </div>`
    ]
  },
  inperson: {
    id: "inperson",
    experimentType: "children_inperson_easier_to_draw",
    dbgPrefix: "[SB-CHILD-INPERSON]",
    ...EASIER_TO_DRAW_TRIAL,
    introPages: [
      PARENT_CHILD_WELCOME_HTML,
      `<div class="sb-container sb-instruction-page">
        <h1 class="sb-page-title">Get Ready!</h1>
      </div>`
    ]
  }
};

const CUSTOM_SLUG_PATTERN = /^[a-z][a-z0-9]{5,11}$/;

const RESERVED_PATH_SEGMENTS = new Set([
  "admin",
  "online",
  "inperson",
  "api",
  "human-experiment",
  "general_assets",
  "stimuli_pipe",
  "stl",
  "glb",
  "models",
  "vendor"
]);

export function resolveCustomStudySlug(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (normalized === "/") return null;
  const slug = normalized.slice(1).split("/")[0];
  if (!slug || RESERVED_PATH_SEGMENTS.has(slug) || !CUSTOM_SLUG_PATTERN.test(slug)) {
    return null;
  }
  return slug;
}

function applyCustomStudyOverrides(variant, customStudy) {
  if (!customStudy) return variant;
  const overrides = customStudy.copy_overrides || {};
  const comparisonPrompt = customStudy.comparison?.prompt || null;
  const choiceButtons = [
    overrides.choice_button_a,
    overrides.choice_button_b
  ];
  const hasChoiceButtons = choiceButtons.every(Boolean);

  return {
    ...variant,
    customSlug: customStudy.slug,
    trialTitle: overrides.trial_title || comparisonPrompt || variant.trialTitle,
    trialSubtitle: overrides.trial_subtitle || variant.trialSubtitle,
    choiceButtons: hasChoiceButtons ? choiceButtons : variant.choiceButtons,
    choicePromptLocked: overrides.choice_prompt_locked || variant.choicePromptLocked,
    choicePromptUnlocked: overrides.choice_prompt_unlocked || variant.choicePromptUnlocked
  };
}

export function buildStudyVariant(pathname = window.location.pathname, customStudy = null) {
  if (customStudy?.study_variant && STUDY_VARIANTS[customStudy.study_variant]) {
    return applyCustomStudyOverrides(STUDY_VARIANTS[customStudy.study_variant], customStudy);
  }
  return resolveStudyVariant(pathname);
}

export function resolveStudyVariant(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (normalized === "/online" || normalized.endsWith("/online")) {
    return STUDY_VARIANTS.online;
  }
  if (normalized === "/inperson" || normalized.endsWith("/inperson")) {
    return STUDY_VARIANTS.inperson;
  }
  return STUDY_VARIANTS.complexity;
}
