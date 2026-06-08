"use client";

// Karochat — pending-contact flush (Wave 22).
//
// When a brand-new full-access signup has to confirm via a one-time email
// (because Supabase email confirmation is ON), the phone can't be saved at
// submit time. We stash {email, phone} in localStorage and this global writes
// it via register_contact once the user is signed in and onboarded. No-op in
// the common (instant) path. Renders null, never throws.

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PENDING_KEY = "karochat:pending-contact";

export function ContactFlush() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let pend: { email?: string; phone?: string } | null = null;
    try {
      pend = JSON.parse(raw);
    } catch {
      try {
        window.localStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!pend?.email || !pend?.phone) {
      try {
        window.localStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return; // not signed in yet — keep pending for later
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, contact_phone")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof?.username) return; // pre-onboarding — wait
      if (prof.contact_phone) {
        try {
          window.localStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      const { error } = await supabase.rpc("register_contact", {
        p_email: pend!.email,
        p_phone: pend!.phone
      });
      if (!error) {
        try {
          window.localStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  return null;
}
