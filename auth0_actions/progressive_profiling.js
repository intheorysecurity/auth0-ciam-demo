/**
 * Auth0 Action (Post Login) - Progressive Profiling (demo)
 *
 * Demo convention (simple query param on the /authorize request):
 * - pp=1  -> render the progressive profiling Form for this transaction.
 *
 * In this demo, the application decides *when* to trigger the form (e.g. user
 * visits /courses but is missing given_name/family_name). The Form itself
 * handles collecting data and updating the user profile.
 *
 * Configure this Action secret:
 * - PROGRESSIVE_PROFILING_FORM_ID = <YOUR_AUTH0_FORM_ID>
 *
 * Docs: api.prompt.render(formId) in Post-Login Actions:
 * https://auth0.com/docs/customize/forms/render
 */

/**
 * @param {Event} event
 * @param {PostLoginAPI} api
 */
exports.onExecutePostLogin = async (event, api) => {
  const q = (event && event.request && event.request.query) || {}

  // Simple demo toggle: pp=1
  if (!(q.pp === '1' || q.pp === 'true')) return

  const formId = event.secrets && event.secrets.PROGRESSIVE_PROFILING_FORM_ID
  if (!formId) {
    // Fail-open (demo): don’t block login if the secret isn’t configured.
    console.log(
      'Progressive profiling skipped: missing Action secret PROGRESSIVE_PROFILING_FORM_ID'
    )
    return
  }

  // Render your Auth0 Form (you’ll paste the real Form ID into the secret later).
  api.prompt.render(formId)
}

/**
 * @param {Event} event
 * @param {PostLoginAPI} api
 */
exports.onContinuePostLogin = async (event, api) => {
  // No-op: the Form/Flow is responsible for persisting updates in this demo.
}

