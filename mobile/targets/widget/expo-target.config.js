// Home screen widget: your next shift, the next few after it, and this pay period's estimate.
// The app shares that data through a keychain group both of them can read.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "widget",
  name: "RosterBoardWidget",
  displayName: "Roster Board",
  bundleIdentifier: ".widget",
  deploymentTarget: "17.0",
  colors: { $accent: "#C8975F", $widgetBackground: "#132849" },
  entitlements: { "keychain-access-groups": ["$(AppIdentifierPrefix)net.rosterboard.shared"] },
});
