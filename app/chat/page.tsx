import { redirect } from "next/navigation";

// Old single-lobby route kept for back-compat. Always lands the user on the
// rooms picker now — they can choose the Lobby (or any other room) from there.
export default function ChatPage() {
  redirect("/rooms");
}
