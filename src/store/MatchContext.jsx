import { createContext, useContext, useState } from 'react'
import { loadJson, saveJson } from '../utils'

const MatchContext = createContext(null)

const MATCH_KEY = 'mt_match'

// 심리테스트 답변 → 매칭 결과 → 식당 선택까지 화면 간에 공유되는 상태
export function MatchProvider({ children }) {
  const [answers, setAnswers] = useState({})
  const [profile, setProfile] = useState(null)
  const [match, setMatchState] = useState(() => loadJson(MATCH_KEY))
  const [restaurant, setRestaurant] = useState(null)

  const setMatch = (next) => {
    setMatchState(next)
    if (next) saveJson(MATCH_KEY, next)
    else localStorage.removeItem(MATCH_KEY)
  }

  const setAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))

  const resetTest = () => {
    setAnswers({})
    setProfile(null)
  }

  const value = {
    answers,
    setAnswer,
    resetTest,
    profile,
    setProfile,
    match,
    setMatch,
    restaurant,
    setRestaurant,
  }

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
}

export function useMatch() {
  const context = useContext(MatchContext)
  if (!context) {
    throw new Error('useMatch must be used within a MatchProvider')
  }
  return context
}
