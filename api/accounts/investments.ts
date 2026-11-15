import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { investmentSummary } from '@mint/shared/engines/investments'
import { isInvestmentNature } from '@mint/shared/schemas/accounts'
import type { InvestmentSummary } from '@mint/shared/types/valuations'
import { toAccountInput, toOperationInput } from '../planning/inputs.js'
import type { AccountModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

export async function loadInvestmentSummaries(
  data: DataAccess,
  userId: string,
  accounts: readonly AccountModel[],
  today: string,
  transaction?: Transaction,
): Promise<Map<string, InvestmentSummary>> {
  const investments = accounts.filter((account) =>
    isInvestmentNature(account.nature),
  )
  if (investments.length === 0) {
    return new Map()
  }
  const accountIds = investments.map((account) => account.id)
  const valuations = await data.models.Valuation.findAll({
    where: { userId, accountId: { [Op.in]: accountIds } },
    transaction,
  })
  const operations = (
    await data.models.Transaction.findAll({
      where: {
        userId,
        accountId: { [Op.in]: accountIds },
        date: { [Op.lte]: today },
      },
      transaction,
    })
  ).map(toOperationInput)
  return new Map(
    investments.map((account) => [
      account.id,
      investmentSummary(toAccountInput(account, valuations), operations, today),
    ]),
  )
}
