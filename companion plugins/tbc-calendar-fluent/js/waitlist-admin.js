/**
 * TBC WooCommerce Calendar - Waitlist Admin
 * 
 * @package TBC_WC_Calendar
 */
;(function($){
  "use strict";

  $(function(){
    // Cached selectors
    const $table              = $(".tbc-wc-waitlist-users-table");
    const $tbody              = $table.find("tbody");
    const $filterSelect       = $("#tbc-wc-filter-event-date");
    const $selectAllCheckbox  = $(".tbc-wc-select-all-checkbox");

    // Helper: Centralized AJAX POST
    function postAction(action, data, onSuccess, onError) {
      const payload = $.extend({}, data, {
        action: action,
        nonce: tbc_wc_waitlist.nonce
      });

      $.post(ajaxurl, payload)
        .done(response => {
          if (response.success) {
            onSuccess(response);
          } else {
            alert("Error: " + response.data);
            if (onError) onError(response);
          }
        })
        .fail(() => {
          alert("Server error occurred");
          if (onError) onError();
        });
    }

    // Filter table by selected date
    $filterSelect.on("change", () => {
      const date = $filterSelect.val();
      $tbody.find("tr").hide();
      
      if (date === "all") {
        $tbody.find("tr").show();
      } else {
        $tbody.find(`tr[data-event-date="${date}"]`).show();
      }
    });

    // Master "select all" checkbox toggles only visible rows
    $selectAllCheckbox.on("change", function(){
      const checked = $(this).prop("checked");
      $tbody.find("tr:visible .tbc-wc-user-select").prop("checked", checked);
    });

    // Bulk action handlers
    $(document).on("click", ".tbc-wc-notify-selected", function(e){
      e.preventDefault();
      const $btn      = $(this);
      const productId = $btn.data("product-id");
      const subject   = $("#tbc-wc-waitlist-email-subject").val();
      const content   = $("#tbc-wc-waitlist-email-content").val();
      const userIds   = [];
      
      $tbody.find("tr:visible .tbc-wc-user-select:checked").each((_, cb) => {
        const $cb = $(cb);
        userIds.push($cb.data("user-id"));
      });

      if (userIds.length === 0) {
        alert("Please select at least one user to notify");
        return;
      }

      $btn.prop("disabled", true).text("Sending...");

      postAction(
        "tbc_wc_send_waitlist_notification",
        {
          product_id: productId,
          user_ids: userIds,
          subject: subject,
          content: content
        },
        response => {
          // Update email status for all notified users
          if (response.data.status_updates) {
            response.data.status_updates.forEach(update => {
              const $row = $tbody.find(`tr[data-user-id="${update.user_id}"][data-event-date="${update.event_date}"]`);
              if ($row.length) {
                $row.find('.tbc-wc-email-status').text(update.status_text);
              }
            });
          }
          
          $btn.text("Sent");
          setTimeout(() => $btn.prop("disabled", false).text("Notify Selected"), 2000);
        }
      );
    });

    $(document).on("click", ".tbc-wc-remove-selected", function(e){
      e.preventDefault();
      const $btn      = $(this);
      const $checked  = $tbody.find("tr:visible .tbc-wc-user-select:checked");
      const count     = $checked.length;

      if (count === 0) {
        alert("Please select at least one user to remove");
        return;
      }
      if (!confirm(`Are you sure you want to remove ${count} users from the waitlist?`))
        return;

      $btn.prop("disabled", true).text("Removing...");
      const rows = $checked.closest("tr").toArray();

      (function processNext(idx){
        if (idx >= rows.length) {
          $btn.prop("disabled", false).text("Remove Selected");
          return;
        }
        const $row      = $(rows[idx]);
        const productId = $row.find(".tbc-wc-remove-user").data("product-id");
        const eventDate = $row.find(".tbc-wc-remove-user").data("event-date");
        const userId    = $row.find(".tbc-wc-remove-user").data("user-id");

        postAction(
          "tbc_wc_remove_from_waitlist",
          { product_id: productId, event_date: eventDate, user_id: userId },
          () => {
            $row.fadeOut(400, () => {
              $row.remove();
              processNext(idx + 1);
            });
          },
          () => {
            processNext(idx + 1);
          }
        );
      })(0);
    });

    // Single-user actions
    $table
      .on("click", ".tbc-wc-notify-user", function(e){
        e.preventDefault();
        const $btn       = $(this);
        const $row       = $btn.closest("tr");
        const productId  = $btn.data("product-id");
        const eventDate  = $btn.data("event-date");
        const userId     = $btn.data("user-id");
        const subject    = $("#tbc-wc-waitlist-email-subject").val();
        const content    = $("#tbc-wc-waitlist-email-content").val();

        $btn.prop("disabled", true).text("Sending...");

        postAction(
          "tbc_wc_send_waitlist_notification",
          {
            product_id: productId,
            event_date: eventDate,
            user_ids: [userId],
            subject: subject,
            content: content
          },
          response => {
            // Update email status for this user
            if (response.data.status_updates && response.data.status_updates.length > 0) {
              const update = response.data.status_updates[0];
              $row.find('.tbc-wc-email-status').text(update.status_text);
            }
            
            $btn.text("Sent");
            setTimeout(() => $btn.prop("disabled", false).text("Notify"), 2000);
          }
        );
      })

      .on("click", ".tbc-wc-remove-user", function(e){
        e.preventDefault();
        if (!confirm(tbc_wc_waitlist.confirm_remove)) return;

        const $btn      = $(this);
        const $row      = $btn.closest("tr");
        const productId = $btn.data("product-id");
        const eventDate = $btn.data("event-date");
        const userId    = $btn.data("user-id");

        $btn.prop("disabled", true).text("Removing...");

        postAction(
          "tbc_wc_remove_from_waitlist",
          { product_id: productId, event_date: eventDate, user_id: userId },
          () => {
            $row.fadeOut(400, () => {
              $row.remove();
              // Remove empty date filter option
              if (!$tbody.find(`tr[data-event-date="${eventDate}"]`).length) {
                $filterSelect.find(`option[value="${eventDate}"]`).remove();
              }
              // Update "All" count
              const total = $tbody.find("tr").length;
              $filterSelect.find("option[value='all']")
                .text(`All Dates (${total})`);
              // If none left, show a message
              if (total === 0) {
                $table.after("<p>No users on waitlist for this product.</p>").remove();
              }
            });
          },
          () => {
            $btn.prop("disabled", false).text("Remove");
          }
        );
      });
  });

})(jQuery);