import '../styles/globals.css'
import { BackgroundEffects } from '../components/BackgroundEffects'

function MyApp({ Component, pageProps }) {
  return (
    <div className="min-h-screen">
      <BackgroundEffects />
      <Component {...pageProps} />
    </div>
  )
}

export default MyApp