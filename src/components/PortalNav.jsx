import logoUrl from "../assets/logo.png";

export function PortalNav() {
  return (
    <nav className="nav portalNav">
      <div className="wrap navin">
        <div className="brand"><img src={logoUrl} alt="The Anchor Collective logo" /><span>THE ANCHOR COLLECTIVE</span></div>
      </div>
    </nav>
  );
}
