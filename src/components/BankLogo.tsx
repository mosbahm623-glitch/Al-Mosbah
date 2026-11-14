import { knownBankLogo } from '../lib/bankLogos'

/** A bank's logo (uploaded, else a known bank's built-in one), or its first letter when it has none. */
export default function BankLogo({ logo, name }: { logo: string | null; name: string }) {
  const src = logo ?? knownBankLogo(name)
  return src ? (
    <img className="bank-logo" src={src} alt="" />
  ) : (
    <span className="bank-logo bank-logo-empty" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
