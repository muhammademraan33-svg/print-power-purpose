import { Card, CardContent } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { getDonationProgress } from '@/lib/utils'

interface DonationBarometerProps {
  totalCents: number
  donationCents: number
  causeName: string
}

export default function DonationBarometer({
  totalCents,
  donationCents,
  causeName,
}: DonationBarometerProps) {
  const progress = getDonationProgress(totalCents)
  const progressPercent = progress.nextThreshold > 0
    ? ((totalCents % 5000) / 5000) * 100
    : 100

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Donation:</span>
            <span className="font-semibold text-primary">
              {formatPrice(donationCents)}
            </span>
          </div>
          
          {progress.amountNeeded > 0 ? (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress to next $10</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Add {formatPrice(progress.amountNeeded)} more to donate another $10 to {causeName}!
              </p>
            </>
          ) : (
            <p className="text-sm text-center text-primary font-semibold">
              🎉 You've unlocked a $10 donation to {causeName}!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
