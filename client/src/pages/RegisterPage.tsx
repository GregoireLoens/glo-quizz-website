import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AvatarPicker } from '../components/AvatarPicker'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { GlowBackdrop } from '../components/GlowBackdrop'
import { NavBar } from '../components/NavBar'
import { api, ApiError } from '../lib/api'
import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import type { AuthResponse, User } from '../lib/types'
import { useAuthStore } from '../stores/authStore'

/** Deux étapes sur une seule route : le pseudo, puis l'avatar. Le compte est créé dès la
 * première (« ce pseudo est déjà pris » ne doit pas arriver après un choix de couleur) ;
 * la seconde ne fait que poser la marque, et se saute. Le code unique vient après, sur
 * /register/code — c'est la dernière chose que voit le nouveau joueur. */
export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const setUser = useAuthStore((s) => s.setUser)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // renseigné une fois le compte créé : on passe à l'étape avatar
  const [account, setAccount] = useState<{ code: string; username: string } | null>(null)
  const [avatar, setAvatar] = useState<{ color: AvatarColor; symbol: AvatarSymbol | null }>({
    color: 'citron',
    symbol: null,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/api/auth/register', { username: username.trim() })
      setSession(res.token, res.user)
      // le serveur a déjà attribué une couleur dérivée du pseudo : c'est elle qu'on présélectionne
      setAvatar({ color: res.user.avatarColor, symbol: res.user.avatarSymbol })
      setAccount({ code: res.code ?? '', username: res.user.username })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Ce pseudo est déjà pris — essaie une variante.')
      } else if (err instanceof ApiError && err.status === 422) {
        setError('3 à 20 caractères : lettres, chiffres, tirets ou underscores.')
      } else {
        setError('Impossible de créer le compte pour le moment. Réessaie.')
      }
    } finally {
      setLoading(false)
    }
  }

  const goToCode = () => {
    if (account) navigate('/register/code', { state: { code: account.code, username: account.username } })
  }

  const saveAvatar = async () => {
    if (loading) return
    setLoading(true)
    try {
      setUser(await api.post<User>('/api/auth/avatar', avatar))
    } catch {
      // l'avatar reste celui attribué à l'inscription : jamais de blocage sur le code unique,
      // qui est la seule chose vraiment irrattrapable de cette page
    } finally {
      setLoading(false)
      goToCode()
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop color="var(--color-violet)" x="82%" y="-8%" size={680} opacity={0.13} />
      <NavBar variant="auth" />

      {account === null ? (
        <form
          onSubmit={submit}
          className="relative mx-auto mt-12 flex w-full max-w-[480px] flex-col items-center gap-[22px] pb-20 sm:mt-[72px]"
        >
          <div className="flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
            <span className="h-1.5 w-1.5 rounded-full bg-citron" />
            <span className="text-xs font-semibold uppercase tracking-wider text-citron">
              Sans e-mail, sans mot de passe
            </span>
          </div>

          <h1 className="text-center font-display text-[36px] font-semibold leading-[1.1] text-cream sm:text-[44px]">
            Choisis ton
            <br />
            pseudo de jeu
          </h1>
          <p className="max-w-[380px] text-center text-[15px] leading-[22px] text-muted-soft">
            C'est le seul identifiant dont tu as besoin. On te donnera ensuite un code unique pour te
            reconnecter.
          </p>

          <div className="mt-2 w-full">
            <Field
              label="Pseudo"
              inputSize="lg"
              placeholder="FalconRouge92"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              hint="3 à 20 caractères, visible par les autres joueurs."
              error={error}
              autoFocus
              maxLength={20}
            />
          </div>

          <Button type="submit" size="hero" full iconRight="→" disabled={username.trim().length < 3 || loading}>
            {loading ? 'Création…' : 'Continuer'}
          </Button>

          <span className="mt-1.5 text-[13px] text-muted">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-semibold text-citron hover:underline">
              Se connecter
            </Link>
          </span>
        </form>
      ) : (
        <div className="relative mx-auto mt-12 flex w-full max-w-[480px] flex-col items-center gap-[22px] pb-20 sm:mt-[72px]">
          <div className="flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
            <span className="h-1.5 w-1.5 rounded-full bg-citron" />
            <span className="text-xs font-semibold uppercase tracking-wider text-citron">
              Compte créé, {account.username}
            </span>
          </div>

          <h1 className="text-center font-display text-[36px] font-semibold leading-[1.1] text-cream sm:text-[44px]">
            Ta marque
            <br />
            de joueur
          </h1>
          <p className="max-w-[400px] text-center text-[15px] leading-[22px] text-muted-soft">
            Une couleur, et un symbole si tu préfères tes initiales. C'est ce qu'on verra de toi dans
            les salons, en partie et au classement — modifiable à tout moment.
          </p>

          <div className="mt-2 w-full rounded-xl border border-line bg-card p-5">
            <AvatarPicker
              username={account.username}
              color={avatar.color}
              symbol={avatar.symbol}
              onChange={setAvatar}
            />
          </div>

          <Button size="hero" full iconRight="→" disabled={loading} onClick={saveAvatar}>
            {loading ? 'Enregistrement…' : 'Continuer'}
          </Button>
          <button
            type="button"
            onClick={goToCode}
            className="cursor-pointer text-[13px] text-muted hover:text-cream-soft"
          >
            Plus tard
          </button>
        </div>
      )}
    </div>
  )
}
