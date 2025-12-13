import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Users } from "lucide-react"

interface CounterCardProps {
    title: string
    value: string
    status?: string
    waitTime?: number
    details?: string
}

export function CounterCard({ title, value, status = 'normal', waitTime, details }: CounterCardProps) {
    // Status colors
    const statusColors: Record<string, { bg: string; text: string; border: string; badgeBg: string }> = {
        normal: {
            bg: 'bg-card',
            text: 'text-success',
            border: 'border-success/20',
            badgeBg: 'bg-success/10 text-success border-success/20'
        },
        busy: {
            bg: 'bg-card',
            text: 'text-warning',
            border: 'border-warning/20',
            badgeBg: 'bg-warning/10 text-warning border-warning/20'
        },
        critical: {
            bg: 'bg-card',
            text: 'text-destructive',
            border: 'border-destructive/20',
            badgeBg: 'bg-destructive/10 text-destructive border-destructive/20'
        }
    }

    const colors = statusColors[status] || statusColors.normal

    return (
        <Card className={`${colors.bg} border-2 ${colors.border} transition-all hover:shadow-lg`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <Badge variant="outline" className={colors.badgeBg}>
                        {status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                    <Users className={`h-5 w-5 ${colors.text}`} />
                    <div className="text-3xl font-bold text-foreground">{value}</div>
                    <span className="text-sm text-muted-foreground">people</span>
                </div>
                
                {waitTime !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>~{waitTime} min wait</span>
                    </div>
                )}

                {details && (
                    <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                        {details}
                    </p>
                )}

                <div className="flex items-center gap-1 pt-1">
                    <div className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')} animate-pulse`} />
                    <span className="text-xs text-muted-foreground">Live</span>
                </div>
            </CardContent>
        </Card>
    )
}
