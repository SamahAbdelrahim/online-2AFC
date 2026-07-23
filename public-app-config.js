function getPublicAppUrl() {
  return String(process.env.APP_URL || "").replace(/\/$/, "");
}

function getPublicAppConfig() {
  const appUrl = getPublicAppUrl();
  const completionCode = process.env.PROLIFIC_COMPLETION_CODE || "TESTCODE";

  return {
    completion_code: completionCode,
    app_url: appUrl || null,
    default_stim_set: process.env.DEFAULT_STIM_SET || "stimuli_A_auto_contrast",
    comparison_config_path: "configs/comparison_survey.json"
  };
}

module.exports = {
  getPublicAppUrl,
  getPublicAppConfig
};
