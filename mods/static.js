import badgen from "../helpers/badge";

const errBadge = { label: "static badge", status: "unknown", color: "grey" };
export default function handleStaticBadge({ label, status, color }, options) {
  try {
    return {
      subject: decodeURIComponent(label),
      status: decodeURIComponent(status),
      color: decodeURIComponent(color),
    };
  } catch (err) {
    console.log("error serving static badge", err.message);
    return errBadge;
  }
}
