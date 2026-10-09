import { useLocation, useNavigate } from "react-router-dom";

/** Back control shown on every page except the dashboard (the home view). */
export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  if (location.pathname === "/") return null;

  function goBack() {
    // Prefer real history; fall back to the dashboard if there is none.
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  return (
    <button
      className="btn-ghost mb-3"
      onClick={goBack}
      aria-label="Go back to the previous page"
    >
      <span aria-hidden="true">&#8592;</span> Back
    </button>
  );
}
