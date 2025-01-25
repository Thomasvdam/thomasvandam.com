"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {isRevealed ? (
          <p className="text-center text-lg font-medium">{hiddenText}</p>
        ) : (
          <div className="w-full h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        )}
        <Button onClick={handleReveal} disabled={isRevealed}>
          {isRevealed ? "Revealed!" : "Reveal Solution"}
        </Button>
      </CardContent>
    </Card>
  )
}

export default RevealText

