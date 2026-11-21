import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  users: {
    activeMonth: r.one.months({
      from: r.users.activeMonthId,
      to: r.months.id,
      alias: 'user_active_month',
    }),
    months: r.many.months({ alias: 'user_months' }),
    currencyRates: r.many.currencyRates(),
    monthPlans: r.many.monthPlans(),
  },
  currencyRates: {
    user: r.one.users({
      from: r.currencyRates.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  months: {
    user: r.one.users({
      from: r.months.userId,
      to: r.users.id,
      optional: false,
      alias: 'user_months',
    }),
    categories: r.many.categories(),
    aiInsights: r.many.aiInsights(),
  },
  categories: {
    month: r.one.months({
      from: r.categories.monthId,
      to: r.months.id,
      optional: false,
    }),
    entries: r.many.entries(),
  },
  entries: {
    category: r.one.categories({
      from: r.entries.categoryId,
      to: r.categories.id,
      optional: false,
    }),
  },
  monthPlans: {
    user: r.one.users({
      from: r.monthPlans.userId,
      to: r.users.id,
      optional: false,
    }),
    budgetLines: r.many.budgetLines(),
  },
  budgetLines: {
    plan: r.one.monthPlans({
      from: [r.budgetLines.userId, r.budgetLines.monthKey],
      to: [r.monthPlans.userId, r.monthPlans.monthKey],
      optional: false,
    }),
  },
  aiInsights: {
    month: r.one.months({
      from: r.aiInsights.monthId,
      to: r.months.id,
      optional: false,
    }),
  },
}));
