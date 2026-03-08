import { EucMap } from '@/components/EucMap';
import { useYandexMetrika } from '@/hooks/useYandexMetrika';

function App() {
  useYandexMetrika()
  return (
    <div className="fixed inset-0 w-full h-full safe-area-padding">
      <EucMap />
    </div>
  )
}

export default App
