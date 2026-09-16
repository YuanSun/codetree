package wcdb

import (
	"context"
	"fmt"
	"strconv"
)

func (ds *DataSource) GetSNSTimeline(ctx context.Context, username string, limit, offset int) ([]map[string]interface{}, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := `SELECT tid, user_name, content, pack_info_buf FROM SnsTimeLine`
	if username != "" {
		query += ` WHERE user_name = ` + strconv.Quote(username)
	}
	query += ` ORDER BY tid DESC`
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
		if offset > 0 {
			query += fmt.Sprintf(" OFFSET %d", offset)
		}
	}
	return ds.client.Query("sns", "", query)
}
