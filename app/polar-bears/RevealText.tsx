"use client"

import type React from "react"
import { useState } from "react"
import styles from "@/app/experiment.module.css"

interface RevealTextProps {
  title: string
  hiddenText: string
}

const RevealText: React.FC<RevealTextProps> = ({ title, hiddenText }) => {
  const [isRevealed, setIsRevealed] = useState(false)

  const handleReveal = () => {
    setIsRevealed(true)
  }

  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <div className={styles.panelBody}>
        {isRevealed ? (
          <p className={styles.answer}>{hiddenText}</p>
        ) : (
          <div className={`${styles.answer} ${styles.placeholder}`} aria-hidden="true">Hidden</div>
        )}
        <button className={styles.button} onClick={handleReveal} disabled={isRevealed}>
          {isRevealed ? "Revealed!" : "Reveal Solution"}
        </button>
      </div>
    </section>
  )
}

export default RevealText
