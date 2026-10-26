// Format tampilan untuk pengguna Indonesia. Waktu selalu ditampilkan dalam WIB (NFR-07).

const numberFormat = new Intl.NumberFormat("id-ID");

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatNumber(value) {
  return numberFormat.format(value);
}

export function formatDateTime(isoString) {
  return isoString ? dateTimeFormat.format(new Date(isoString)) : "—";
}

export function formatDate(dateString) {
  return dateString
    ? dateFormat.format(new Date(`${dateString}T00:00:00Z`))
    : "—";
}
