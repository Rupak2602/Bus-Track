
import { supabase } from "../config/supabase.js";

const notificationList = document.getElementById("notificationsList");
const unreadCount = document.getElementById("unreadCount");
const statusMessage = document.getElementById("statusMessage");
const markAllReadButton = document.getElementById("markAllRead");

async function loadNotifications() {
  try {
    if (statusMessage) {
      statusMessage.textContent = "Checking student account...";
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      if (statusMessage) {
        statusMessage.textContent = "Please log in to view notifications.";
      }
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const notifications = data || [];
    const unread = notifications.filter(
      item => item.is_read !== true
    );

    if (unreadCount) {
      unreadCount.textContent = String(unread.length);
    }

    if (notificationList) {
      notificationList.replaceChildren();

      if (notifications.length === 0) {
        notificationList.textContent =
          "No notifications yet. Bus updates will appear here.";
      } else {
        notifications.forEach(item => {
          const card = document.createElement("article");
          card.className = "notification-card";

          const title = document.createElement("h3");
          title.textContent = item.title || "Bus update";

          const message = document.createElement("p");
          message.textContent =
            item.message || item.body || "You have a new notification.";

          const time = document.createElement("small");
          time.textContent = item.created_at
            ? new Date(item.created_at).toLocaleString()
            : "";

          card.append(title, message, time);
          notificationList.appendChild(card);
        });
      }
    }

    if (statusMessage) {
      statusMessage.textContent = "";
    }
  } catch (error) {
    console.error("Notification loading failed:", error);

    if (statusMessage) {
      statusMessage.textContent =
        "Unable to load notifications. Check the browser console.";
    }
  }
}

if (markAllReadButton) {
  markAllReadButton.addEventListener("click", async () => {
    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please log in again.");

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      await loadNotifications();
    } catch (error) {
      console.error("Mark all read failed:", error);
      if (statusMessage) {
        statusMessage.textContent = "Could not mark notifications as read.";
      }
    }
  });
}

loadNotifications();
