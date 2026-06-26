import logoUrl from "../assets/logo.png";

export function PortalNav() {
  return (
    <nav className="nav">
      <div className="wrap navin">
        <a className="brand" href="../index.html"><img src={logoUrl} alt="The Anchor Collective logo" /><span>THE ANCHOR COLLECTIVE</span></a>
        <div className="links">
          <a href="../events.html">Events</a>
          <a href="../family-resources.html">Family Resources</a>
          <a href="../podcasts.html">Podcasts</a>
          <a href="../donations.html">Donate</a>
        </div>
      </div>
    </nav>
  );
}
