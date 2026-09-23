"use client"

import type React from "react"
import { useState } from "react"
import styles from "@/app/experiment.module.css"

interface ExpanderProps {
  title: string
  preview: string
  fullText: string
}

const Expander: React.FC<ExpanderProps> = ({ title, preview, fullText }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <div className={styles.panelBody}>
        <p className={styles.bodyCopy}>{isExpanded ? fullText : preview}</p>
        <button className={styles.button} onClick={toggleExpand} aria-expanded={isExpanded}>
          {isExpanded ? "Show less ↑" : "Read more ↓"}
        </button>
      </div>
    </section>
  )
}

export default Expander
