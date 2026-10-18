// Words on the public pages that change often. Edit here; the landing page picks them up.

/** Where people can reach you (footer and the Terms/Privacy pages). Empty hides the Contact link. */
export const CONTACT_EMAIL = "";

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is NEXA free?",
    a: "Yes. Clubs, organizers and players don't pay anything, and there are no ads.",
  },
  {
    q: "Do players need an account?",
    a: "No. Only organizers log in. Players open the link from the group chat or scan the QR at the court and tap their name.",
  },
  {
    q: "How do players check in?",
    a: "At the court they scan the check-in QR, or the organizer taps Here on their name. Members can tap I'm coming from the group chat, but they only join the line once they're at the court.",
  },
  {
    q: "How does it decide who plays next?",
    a: "Whoever has waited longest plays next, and after each game all four go to the back of the line. The matching mode you pick (balanced, social, skill groups or winners vs winners) decides who plays with whom.",
  },
  {
    q: "What if the internet is slow at the court?",
    a: "NEXA is built for mobile data: phones check for changes every few seconds with tiny requests. If a phone drops off, it catches up as soon as it reconnects.",
  },
  {
    q: "Can we use our own court colors?",
    a: "Yes. Pick a preset or any colors in Team settings. The lines switch to dark on light colors so names stay readable.",
  },
];
