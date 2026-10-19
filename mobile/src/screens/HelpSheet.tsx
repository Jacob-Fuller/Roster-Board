// Help: every part of the app, grouped by where it lives. Tap a topic to open it.
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card, Divider, IconTile, SectionHead, Sheet, useTheme } from "../components/ui";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Topic = { title: string; text: string };
type Group = { title: string; icon: Icon; color: string; topics: Topic[] };

const GROUPS: Group[] = [
  {
    title: "Getting Started", icon: "flag", color: "#2FA36B", topics: [
      { title: "Set Up in Three Steps", text: "1. Add your shift types on the Types tab.\n2. Build your rotation on the Roster tab and fill your calendar from it.\n3. Enter your hourly rate in Reports → Pay Setup to see what you'll earn." },
      { title: "Your Account and Devices", text: "Sign in and your roster is backed up to your account and kept in sync on every device, including the website at rosterboard.net. You can also use the app without an account, in which case your roster stays on this phone only." },
    ],
  },
  {
    title: "Shift Types", icon: "color-palette", color: "#A76BF0", topics: [
      { title: "Work Shifts", text: "Give each shift a name, a colour, an optional icon and a start and finish time. The hours are worked out for you, including shifts that run past midnight." },
      { title: "Overtime and Excess", text: "Each work shift can allow excess hours, overtime, or both. Turn these off for shifts that never have them and the options won't show when you add that shift." },
      { title: "Borders", text: "Pick a border to make a shift stand out on the calendar. Each style is drawn in shades of the shift's own colour." },
      { title: "Personal Types", text: "Mark a type as Personal for things that aren't work, like the gym or school pick-up. They show on the calendar but never count towards your hours, reports or pay. You can add one to every day across a date range in one go." },
      { title: "Alarms", text: "Set an alarm on a shift type and a real iPhone alarm goes off that long before every one of those shifts. Alarms need iOS 26 or later and are part of Premium." },
    ],
  },
  {
    title: "Calendar", icon: "calendar", color: "#4C8DFF", topics: [
      { title: "Adding a Shift", text: "Tap a day, then tap one of your shift types. If the shift can have excess or overtime, choose a plain shift, excess, overtime or both, and enter the hours." },
      { title: "Additional Shifts (part Time)", text: "When part time is set up with an excess limit, add extra shifts as Additional shift and just enter the hours worked. All excess hours in a pay period count toward the limit, and anything past it becomes overtime automatically." },
      { title: "Leave", text: "Tap + Annual Leave or + Sick Leave, pick the shift you're taking off and confirm the hours. The calendar shows that shift with a leave title on it. If the shift was already rostered, the leave replaces it, and removing the leave puts the shift back." },
      { title: "Allowances", text: "Set up your allowances in Pay Setup, such as missed meals and missed breaks. Add them to a day when you add a shift, or with the − and + counters on the day. Each one is added to your estimated pay." },
      { title: "Swaps", text: "Tap Swap next to a shift to move it to another date and note who you swapped with. Both days show the swap on the calendar, and Undo swap puts everything back." },
      { title: "Personal Events", text: "Add appointments, social plans and reminders to any day, all day or at a set time. With Premium on iOS 26 or later, set an alert and a second alert from the time of the event up to a week before." },
      { title: "Filling Many Days at Once", text: "Tap the wand button, choose a shift type, then tap days to add or remove it. Tap Done when you're finished." },
      { title: "Public Holidays", text: "Open a day and turn on Public holiday. Shifts that day are paid at your public holiday penalty rate from Pay Setup." },
      { title: "Moving Between Months", text: "Swipe left or right, or use the arrows. Today takes you back to this month. Every second pay period is shaded once pay is set up." },
    ],
  },
  {
    title: "Roster", icon: "repeat", color: "#3FC5C0", topics: [
      { title: "Your Rotation", text: "Set how many weeks your rotation runs before it repeats, up to 52, and tap each day to add the shifts for that day." },
      { title: "Filling the Calendar", text: "Pick a start date and how far ahead to fill, from 3 months to 2 years, then tap Fill calendar from pattern. It's a one-off: swaps and changes are made on the calendar afterwards as normal." },
    ],
  },
  {
    title: "Reports", icon: "stats-chart", color: "#F0679E", topics: [
      { title: "Totals", text: "See hours, excess, overtime, days worked, leave days and estimated pay for any month or year, plus hours by shift type, weekdays against weekends and a comparison with the previous period." },
      { title: "This Pay Period (part Time)", text: "Shows how many rostered shifts you've done, how much of your excess limit you've used and any overtime in the current pay period." },
      { title: "Estimated Pay", text: "Switch between weekly, fortnightly and monthly, and step back or forward with the arrows or a swipe. Tap Breakdown for every line of your pay, the estimated tax and take-home, and month-by-month totals for the year." },
      { title: "Ticking Off Allowances", text: "In the pay breakdown, tick each allowance once you've seen it on your payslip, so you can see what's still owed." },
      { title: "Year in Review", text: "Switch to Year for your total hours, overtime, excess, busiest month, leave days and best-paid month." },
      { title: "PDF Roster", text: "Tap PDF roster to make a printable roster for a month or a whole year." },
    ],
  },
  {
    title: "Pay Setup", icon: "cash", color: "#2FA36B", topics: [
      { title: "Rates", text: "Enter your hourly rate, your excess and overtime rates, and tiered overtime if the rate goes up after a number of hours." },
      { title: "Pay Cycle", text: "Choose weekly, fortnightly or monthly and the date a pay period starts. This sets the pay periods used for estimated pay, shading and part-time limits." },
      { title: "Penalties and Shift Allowances", text: "Add Saturday, Sunday, public holiday and night shift penalty rates, then choose for each shift type whether penalties apply and whether it earns a shift allowance, either a percentage or a set amount per shift." },
      { title: "Allowances", text: "Add each allowance you can claim, like a missed meal or missed break, with the amount it pays." },
      { title: "Payday Reminder", text: "Turn on Payday reminder under Pay cycle. When each pay period ends you get a notification with its estimated pay and how many allowances you still need to check on your payslip." },
      { title: "Leave, Super and Tax", text: "Choose whether leave is paid and your annual leave loading, your employer super rate, and whether to show estimated tax and take-home using Australian resident rates." },
    ],
  },
  {
    title: "Account", icon: "person-circle", color: "#5B6B82", topics: [
      { title: "Employment", text: "Choose full time or part time. Part time lets you set your pay cycle, rostered shifts per pay period and the excess hours allowed before overtime." },
      { title: "Birthdays", text: "Add birthdays yourself, or let the app show your contacts' birthdays. Contact birthdays update by themselves each time you open the app." },
      { title: "Appearance", text: "Choose light or dark, and whether personal events and birthdays show on the calendar." },
      { title: "Home Screen Widget", text: "Press and hold your home screen, tap Edit then Add Widget, and choose Roster Board. The small widget shows your next shift. The medium one adds the next few shifts and, with Premium, this pay period's estimate." },
      { title: "Calendar App", text: "Turn on Add shifts to the Calendar app and your shifts and leave appear in a Roster Board calendar in the iPhone Calendar app, from last month to a year ahead. It updates whenever your roster changes, and turning it off removes it." },
      { title: "Settings", text: "Change your name, email or password, sign out, clear your calendar or delete your account." },
    ],
  },
  {
    title: "Sharing", icon: "people", color: "#E8A33C", topics: [
      { title: "Share Your Roster", text: "Share your roster with family and friends by email. They see your shifts and leave only. Personal events and notes stay private." },
      { title: "Friends' Rosters", text: "Open a roster that's been shared with you to see their calendar, and swipe through their months just like your own." },
    ],
  },
  {
    title: "Premium", icon: "star", color: "#C8975F", topics: [
      { title: "What's Included", text: "Estimated pay, full reports, roster patterns, roster sharing, alarms, PDF export and unlimited shift types. The free version includes the calendar, up to 3 shift types, leave, events, birthdays and sync. Premium is $4.99 a month or $24.99 once." },
    ],
  },
];

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Help">
      {GROUPS.map((g, gi) => (
        <View key={g.title} style={{ marginTop: gi ? 0 : -8 }}>
          <SectionHead title={g.title} />
          <Card style={{ paddingVertical: 2 }}>
            {g.topics.map((tp, i) => (
              <View key={tp.title}>
                {i ? <Divider /> : null}
                <TopicRow topic={tp} icon={g.icon} color={g.color} />
              </View>
            ))}
          </Card>
        </View>
      ))}
      <View style={{ height: 12 }} />
    </Sheet>
  );
}

function TopicRow({ topic, icon, color }: { topic: Topic; icon: Icon; color: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
      style={({ pressed }) => ({ paddingVertical: 13, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconTile icon={icon} color={color} size={30} />
        <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "600" }}>{topic.title}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={17} color={t.textFaint} />
      </View>
      {open ? <Text style={{ color: t.textDim, fontSize: 14, lineHeight: 21, marginTop: 10, marginLeft: 42 }}>{topic.text}</Text> : null}
    </Pressable>
  );
}
