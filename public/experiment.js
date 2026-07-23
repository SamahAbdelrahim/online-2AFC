import {
  createModelViewer,
  disposeAllModelViewers,
  preloadModels,
  resizeAllModelViewers
} from "./model-viewer.js";
import { buildStudyVariant, resolveCustomStudySlug } from "./study-variants.js";

(async function runExperiment() {
  const url = new URL(window.location.href);
  const customStudySlug = resolveCustomStudySlug(url.pathname);
  let studyVariant = buildStudyVariant(url.pathname);
  const DBG_PREFIX = studyVariant.dbgPrefix;
  let jsPsychMounted = false;
  const mountWatchdogMs = 2000;
  setTimeout(() => {
    if (!jsPsychMounted) {
      console.warn(`${DBG_PREFIX} jsPsych did not mount yet`, {
        after_ms: mountWatchdogMs,
        href: window.location.href,
        readyState: document.readyState
      });
    }
  }, mountWatchdogMs);

  const ck = (label, data) => {
    if (typeof data === "undefined") {
      console.log(`${DBG_PREFIX} ${label}`);
    } else {
      console.log(`${DBG_PREFIX} ${label}`, data);
    }
  };
  const cerr = (label, data) => {
    if (typeof data === "undefined") {
      console.error(`${DBG_PREFIX} ${label}`);
    } else {
      console.error(`${DBG_PREFIX} ${label}`, data);
    }
  };

  ck("Experiment boot start", {
    href: window.location.href,
    study_variant: studyVariant.id,
    custom_study: customStudySlug,
    ts: new Date().toISOString()
  });

  if (
    typeof initJsPsych === "undefined" ||
    typeof jsPsychInstructions === "undefined" ||
    typeof jsPsychHtmlButtonResponse === "undefined"
  ) {
    cerr("Missing jsPsych globals", {
      initJsPsych: typeof initJsPsych,
      jsPsychInstructions: typeof jsPsychInstructions,
      jsPsychHtmlButtonResponse: typeof jsPsychHtmlButtonResponse
    });
    throw new Error(
      "jsPsych core/plugins failed to load. Check CDN access and script URLs in public/index.html."
    );
  }

  const params = url.searchParams;
  const prolificPidParam = params.get("PROLIFIC_PID");
  const studyIdParam = params.get("STUDY_ID");
  const sessionIdParam = params.get("SESSION_ID");
  const isProlificSession = Boolean(prolificPidParam && studyIdParam && sessionIdParam);
  const prolific_pid = prolificPidParam || "debug_pid";
  const study_id = studyIdParam || "debug_study";
  const session_id = sessionIdParam || "debug_session";
  const verboseTrials = params.get("verbose_trials") === "1";

  const trialsQuery = new URLSearchParams({
    prolific_pid,
    study_id,
    session_id,
    study_variant: studyVariant.id
  });
  if (customStudySlug) {
    trialsQuery.set("custom_study", customStudySlug);
  }

  ck("Fetching server config and comparison trials");
  const [configRes, trialsRes] = await Promise.all([
    fetch("/api/config"),
    fetch(`/api/comparison-trials?${trialsQuery.toString()}`)
  ]);

  const appConfig = configRes.ok ? await configRes.json() : {};
  const completionCode = appConfig.completion_code || "TESTCODE";

  if (!trialsRes.ok) {
    const errBody = await trialsRes.text();
    if (customStudySlug) {
      document.body.innerHTML = "<p>This custom study link is not active or does not exist.</p>";
      return;
    }
    document.body.innerHTML = `<p>Failed to load comparison trials: ${errBody}</p>`;
    return;
  }
  const payload = await trialsRes.json();
  studyVariant = buildStudyVariant(url.pathname, payload.custom_study);
  const finalTrials = payload.trials || [];
  const surveyConfig = payload.config || {};

  if (finalTrials.length === 0) {
    document.body.innerHTML = "<p>No comparison trials are available. Add 3D model files (.glb, .gltf, .obj, .fbx, .dae, .ply, .3mf, .stl) to the <code>models/</code>, <code>glb/</code>, or <code>stl/</code> folders and update <code>configs/comparison_survey.json</code>.</p>";
    return;
  }

  ck("Comparison trials loaded", {
    count: finalTrials.length,
    pair_mode: surveyConfig.pair_mode,
    model_count: payload.model_count,
    completion_code: isProlificSession ? completionCode : "debug"
  });

  const modelUrls = [
    ...new Set(
      finalTrials.flatMap((trial) => [trial.model_a?.url, trial.model_b?.url]).filter(Boolean)
    )
  ];

  let modelPreloadPromise = null;

  function startModelPreload() {
    if (!modelPreloadPromise) {
      modelPreloadPromise = preloadModels(modelUrls);
    }
    return modelPreloadPromise;
  }

  if (isProlificSession || window.self !== window.top) {
    document.body.classList.add("sb-prolific-embed");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderTrialHtml(trial) {
    const prompt = escapeHtml(studyVariant.trialTitle || trial.prompt);
    const subtitle = escapeHtml(studyVariant.trialSubtitle);
    const modelAUrl = escapeHtml(trial.model_a.url);
    const modelBUrl = escapeHtml(trial.model_b.url);
    const modelASource = escapeHtml(trial.model_a.source);
    const modelBSource = escapeHtml(trial.model_b.source);
    const modelAName = escapeHtml(trial.model_a.filename);
    const modelBName = escapeHtml(trial.model_b.filename);
    return `
      <div class="sb-container sb-trial-view">
        <h1 class="sb-trial-title">${prompt}</h1>
        <p id="sb-choice-prompt" class="sb-trial-subtitle">${subtitle}</p>
        <div class="sb-trial-grid">
          <div class="sb-trial-column">
            <div class="sb-model-stage">
              <canvas
                class="sb-model-canvas"
                data-model-slot="a"
                data-model-url="${modelAUrl}"
                data-model-source="${modelASource}"
                aria-label="${modelAName}"
              ></canvas>
            </div>
            <div class="sb-choice-slot" data-choice-slot="a"></div>
          </div>
          <div class="sb-trial-column">
            <div class="sb-model-stage">
              <canvas
                class="sb-model-canvas"
                data-model-slot="b"
                data-model-url="${modelBUrl}"
                data-model-source="${modelBSource}"
                aria-label="${modelBName}"
              ></canvas>
            </div>
            <div class="sb-choice-slot" data-choice-slot="b"></div>
          </div>
        </div>
      </div>
    `;
  }

  function fixInstructionNavLabels() {
    const back = document.getElementById("jspsych-instructions-back");
    const next = document.getElementById("jspsych-instructions-next");
    if (back) back.textContent = "Previous";
    if (next) next.textContent = "Next >";
  }

  function mountChoiceButtons() {
    const slotButtons = document.querySelectorAll(".sb-choice-slot .jspsych-btn");
    if (slotButtons.length >= 2) {
      document.getElementById("jspsych-html-button-response-btngroup")?.classList.add("sb-choice-btngroup--mounted");
      return true;
    }

    const btngroup = document.getElementById("jspsych-html-button-response-btngroup");
    if (!btngroup) return false;
    const buttons = [...btngroup.querySelectorAll(".jspsych-btn")];
    if (buttons.length < 2) return false;

    const slotA = document.querySelector('[data-choice-slot="a"]');
    const slotB = document.querySelector('[data-choice-slot="b"]');
    if (!slotA || !slotB) return false;

    buttons.forEach((button) => {
      button.classList.add("sb-choice-btn");
      button.style.margin = "0";
    });
    slotA.appendChild(buttons[0]);
    slotB.appendChild(buttons[1]);
    btngroup.classList.add("sb-choice-btngroup--mounted");
    return true;
  }

  async function ensureChoiceButtonsMounted() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (mountChoiceButtons()) return;
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    cerr("Choice buttons could not be mounted into trial layout");
  }

  for (const trial of finalTrials) {
    if (studyVariant.trialTitle) {
      trial.prompt = studyVariant.trialTitle;
    }
    trial.study_variant = studyVariant.id;
    trial.custom_study_slug = customStudySlug || payload.custom_study?.slug || null;
    trial.stimulus_html = renderTrialHtml(trial);
    trial.prolific_pid = prolific_pid;
    trial.study_id = study_id;
    trial.session_id = session_id;
    trial.completion_code = completionCode;
  }

  function shouldShowFullscreenWarning() {
    // Mobile/tablet: survey is designed to work here; no fullscreen nag
    if (window.matchMedia("(max-width: 900px)").matches) {
      return false;
    }
    if (window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches) {
      return false;
    }

    // Desktop: window not maximized or too small for the task
    const minComfortableWidth = 900;
    const minComfortableHeight = 650;
    const windowTooSmall =
      window.innerWidth < minComfortableWidth || window.innerHeight < minComfortableHeight;
    const notMaximized =
      window.outerWidth < screen.availWidth - 80 ||
      window.outerHeight < screen.availHeight - 80;

    return windowTooSmall || notMaximized;
  }

  function setupFullscreenWarning() {
    const banner = document.createElement("div");
    banner.id = "sb-fullscreen-warning";
    banner.className = "sb-fullscreen-warning sb-fullscreen-warning--hidden";
    banner.textContent = "⚠️ You need to view in full screen!";
    document.body.prepend(banner);

    const update = () => {
      banner.classList.toggle("sb-fullscreen-warning--hidden", !shouldShowFullscreenWarning());
    };

    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      banner.remove();
    };
  }

  let removeFullscreenWarning = setupFullscreenWarning();

  async function prepareTrialChoice() {
    await ensureChoiceButtonsMounted();
    await startModelPreload();
    const promptEl = document.getElementById("sb-choice-prompt");
    const buttons = document.querySelectorAll(".sb-choice-slot .jspsych-btn");
    const explored = new Set();
    let unlocked = false;
    let firstInteractionAt = null;

    const unlockChoices = () => {
      if (unlocked) return;
      unlocked = true;
      if (promptEl) {
        promptEl.textContent = studyVariant.choicePromptUnlocked;
      }
      buttons.forEach((button) => {
        button.disabled = false;
      });
    };

    const onObjectExplored = (canvas) => {
      const slot = canvas.dataset.modelSlot;
      if (!slot || explored.has(slot)) return;
      explored.add(slot);
      if (!firstInteractionAt) {
        firstInteractionAt = Date.now();
      }
      if (explored.size >= 2) {
        unlockChoices();
      }
    };

    buttons.forEach((button) => {
      button.disabled = true;
    });
    if (promptEl) {
      promptEl.textContent = studyVariant.choicePromptLocked;
    }

    await mountTrialViewers(onObjectExplored);

    const interactionWatch = window.setInterval(() => {
      if (unlocked) {
        window.clearInterval(interactionWatch);
        return;
      }
      if (explored.size >= 2) {
        unlockChoices();
        window.clearInterval(interactionWatch);
        return;
      }
      if (firstInteractionAt && Date.now() - firstInteractionAt >= 4000) {
        unlockChoices();
        window.clearInterval(interactionWatch);
      }
    }, 250);

    window.setTimeout(() => {
      unlockChoices();
      window.clearInterval(interactionWatch);
    }, 12000);
  }

  async function mountTrialViewers(onInteract = null) {
    disposeAllModelViewers();
    const canvases = [...document.querySelectorAll(".sb-model-canvas")];
    await Promise.all(
      canvases.map(async (canvas) => {
        try {
          await createModelViewer(canvas, {
            url: canvas.dataset.modelUrl,
            source: canvas.dataset.modelSource,
            label: canvas.getAttribute("aria-label") || "",
            onInteract: onInteract ? () => onInteract(canvas) : null
          });
        } catch (err) {
          cerr("Failed to mount model viewer", err);
        }
      })
    );
    resizeAllModelViewers();
  }

  async function logTrial(data) {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch (_e) {
        bodyText = "<failed to read body>";
      }
      throw new Error(`POST /api/log failed (${res.status}): ${bodyText}`);
    }
    return res;
  }

  const jsPsych = initJsPsych({
    on_finish: () => {
      disposeAllModelViewers();
      if (isProlificSession) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(completionCode)}`;
      }
    }
  });

  jsPsych.data.addProperties({
    prolific_pid,
    study_id,
    session_id,
    study_variant: studyVariant.id,
    custom_study_slug: customStudySlug || payload.custom_study?.slug || null,
    experiment_type: studyVariant.experimentType,
    pair_mode: surveyConfig.pair_mode
  });

  const intro = {
    type: jsPsychInstructions,
    pages: studyVariant.introPages,
    button_label_previous: "Previous",
    button_label_next: "Next",
    on_load: fixInstructionNavLabels,
    on_page_change: (currentPage) => {
      fixInstructionNavLabels();
      if (currentPage >= 1) {
        window.setTimeout(() => startModelPreload(), 0);
      }
    },
    show_clickable_nav: true
  };

  const trialBlock = {
    timeline: [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: jsPsych.timelineVariable("stimulus_html"),
        choices: studyVariant.choiceButtons,
        button_layout: "flex",
        on_load: async () => {
          if (removeFullscreenWarning) {
            removeFullscreenWarning();
            removeFullscreenWarning = null;
          }
          await prepareTrialChoice();
        },
        on_finish: async (data) => {
          disposeAllModelViewers();
          const responseKey = data.response === 0 ? "1" : data.response === 1 ? "2" : null;
          const chosenModel = responseKey === "1" ? data.model_a : responseKey === "2" ? data.model_b : null;
          const trialNumber = Number(data.trial_index) + 1;
          if (verboseTrials || trialNumber <= 3 || trialNumber % 10 === 0) {
            ck("Trial response captured", {
              trialNumber,
              response_key: responseKey,
              chosen: chosenModel?.filename || null,
              rt_ms: data.rt
            });
          }
          const payloadData = {
            prolific_pid: data.prolific_pid,
            study_id: data.study_id,
            session_id: data.session_id,
            completion_code: data.completion_code,
            experiment_type: studyVariant.experimentType,
            study_variant: studyVariant.id,
            custom_study_slug: customStudySlug || payload.custom_study?.slug || null,
            pair_mode: data.pair_mode,
            trial_index: data.trial_index,
            prompt: data.prompt,
            model_a_filename: data.model_a?.filename,
            model_a_source: data.model_a?.source,
            model_a_url: data.model_a?.url,
            model_b_filename: data.model_b?.filename,
            model_b_source: data.model_b?.source,
            model_b_url: data.model_b?.url,
            pair_left_filename: data.pair_left_filename,
            pair_right_filename: data.pair_right_filename,
            pair_left_source: data.pair_left_source,
            pair_right_source: data.pair_right_source,
            side_swapped: data.side_swapped,
            response_key: responseKey,
            chosen_filename: chosenModel?.filename || null,
            chosen_source: chosenModel?.source || null,
            rt_ms: data.rt,
            browser_user_agent: navigator.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            raw_trial: data
          };
          try {
            await logTrial(payloadData);
          } catch (err) {
            cerr("Failed to log trial", {
              trialNumber,
              error: String(err && err.message ? err.message : err)
            });
          }
        },
        data: {
          prolific_pid: jsPsych.timelineVariable("prolific_pid"),
          study_id: jsPsych.timelineVariable("study_id"),
          session_id: jsPsych.timelineVariable("session_id"),
          completion_code: jsPsych.timelineVariable("completion_code"),
          study_variant: jsPsych.timelineVariable("study_variant"),
          trial_index: jsPsych.timelineVariable("trial_index"),
          pair_mode: jsPsych.timelineVariable("pair_mode"),
          prompt: jsPsych.timelineVariable("prompt"),
          model_a: jsPsych.timelineVariable("model_a"),
          model_b: jsPsych.timelineVariable("model_b"),
          pair_left_filename: jsPsych.timelineVariable("pair_left_filename"),
          pair_right_filename: jsPsych.timelineVariable("pair_right_filename"),
          pair_left_source: jsPsych.timelineVariable("pair_left_source"),
          pair_right_source: jsPsych.timelineVariable("pair_right_source"),
          side_swapped: jsPsych.timelineVariable("side_swapped")
        }
      }
    ],
    timeline_variables: finalTrials
  };

  const end = {
    type: jsPsychInstructions,
    pages: [
      `<div class="sb-container sb-end-page"><h1 class="sb-page-title">Thank you!</h1><div class="sb-intro-copy"><p>Your responses have been recorded.</p><p>You will now be redirected to Prolific.</p></div></div>`
    ],
    button_label_previous: "Previous",
    button_label_next: "Next",
    on_load: fixInstructionNavLabels,
    on_page_change: fixInstructionNavLabels,
    show_clickable_nav: true
  };

  const timeline = [intro, trialBlock];
  if (!isProlificSession) {
    timeline.push(end);
  }

  window.addEventListener("resize", resizeAllModelViewers);
  jsPsychMounted = true;
  jsPsych.run(timeline);
})();
