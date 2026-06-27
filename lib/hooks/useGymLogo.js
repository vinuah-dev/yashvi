"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useGymLogo() {
  const [gymLogo, setGymLogo] = useState(null);

  useEffect(() => {
    const fetchLogo = async () => {
      // Try admin gym first
      const storedGym = localStorage.getItem("selectedGym");
      if (storedGym) {
        const gym = JSON.parse(storedGym);
        console.log("useGymLogo: admin gym", gym.logo_url);
        if (gym.logo_url) {
          setGymLogo(gym.logo_url);
          return;
        }
      }

      // Try member gym
      const storedMember = localStorage.getItem("member");
      console.log("useGymLogo: storedMember", storedMember);
      if (storedMember) {
        const member = JSON.parse(storedMember);
        const { data, error } = await supabase
          .from("members")
          .select("gym_id")
          .eq("id", member.id)
          .single();

        console.log("useGymLogo: member gym_id", data?.gym_id, "error:", error);

        if (data?.gym_id) {
          const { data: gymData, error: gymError } = await supabase
            .from("gyms")
            .select("logo_url")
            .eq("id", data.gym_id)
            .single();

          console.log("useGymLogo: logo_url", gymData?.logo_url, "error:", gymError);

          if (gymData?.logo_url) {
            setGymLogo(gymData.logo_url);
          }
        }
      }
    };

    fetchLogo();
  }, []);

  return gymLogo;
}