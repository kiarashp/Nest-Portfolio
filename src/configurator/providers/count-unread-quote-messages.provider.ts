import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { QuoteMessage } from '../entities/quote-message.entity'
import { QuoteMessageSenderRole } from '../enums/quote-message-sender-role.enum'

@Injectable()
export class CountUnreadQuoteMessagesProvider {
  constructor(
    /** inject QuoteMessage repository to build the grouped count query */
    @InjectRepository(QuoteMessage)
    private readonly quoteMessagesRepository: Repository<QuoteMessage>,
  ) {}

  /**
   * Returns a map of savedConfigurationId to the number of unread messages
   * for the given side. A message is unread when it was written by the other
   * side and is newer than the reader's last-read timestamp (or the reader
   * never read the thread at all). One grouped query covers a whole result
   * page — no per-row queries. Ids missing from the map have zero unread.
   */
  public async countUnread(
    ids: number[],
    side: 'user' | 'admin',
  ): Promise<Map<number, number>> {
    if (ids.length === 0) {
      return new Map()
    }

    // the owner reads admin messages and vice versa; each side compares
    // against its own last-read column on the parent snapshot
    const otherRole =
      side === 'user'
        ? QuoteMessageSenderRole.ADMIN
        : QuoteMessageSenderRole.USER
    const readColumn = side === 'user' ? 'userLastReadAt' : 'adminLastReadAt'

    const rows: { savedConfigurationId: number; unread: string }[] =
      await this.quoteMessagesRepository
        .createQueryBuilder('message')
        .select('message.savedConfigurationId', 'savedConfigurationId')
        .addSelect('COUNT(*)', 'unread')
        .innerJoin('message.savedConfiguration', 'sc')
        .where('message.savedConfigurationId IN (:...ids)', { ids })
        .andWhere('message.senderRole = :otherRole', { otherRole })
        .andWhere(
          `(sc.${readColumn} IS NULL OR message.createdAt > sc.${readColumn})`,
        )
        .groupBy('message.savedConfigurationId')
        .getRawMany()

    // COUNT(*) comes back as a string from the pg driver — coerce to number
    return new Map(
      rows.map((row) => [Number(row.savedConfigurationId), Number(row.unread)]),
    )
  }
}
