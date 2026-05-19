import { redirect } from "next/navigation";

// Old single-lobby route. Kept as a redirect for back-compat with any saved links.
export default function ChatPage() {
  redirect("/rooms/00000000-0000-0000-0000-00000000aaaa");
}
