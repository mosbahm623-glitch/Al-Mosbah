/** A bank's logo, or its first letter when it has none. */
export default function BankLogo({ logo, name }: { logo: string | null; name: string }) {
  return logo ? (
    <img className="bank-logo" src={logo} alt="" />
  ) : (
    <span className="bank-logo bank-logo-empty" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
